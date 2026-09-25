import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import PhoneDisplay from "../../../../components/ui/PhoneDisplay";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  type RowLine,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getVolunteers,
  updateVolunteerStatus,
  type VolunteerAccountStatus,
  type VolunteerListItem,
} from "../../../../logic/api/volunteersApi";
import {
  getTasks,
  type Task,
  type TaskDisplayStatus,
  type TaskStatus,
} from "../../../../logic/api/tasksApi";
import { VOLUNTEER_STATUS_TONE } from "../../../../logic/staff/volunteerStatus";
import {
  TASK_NAME_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "../../../../logic/staff/tasks";
import { formatShortDate, formatTime } from "../../../../logic/utils/datetime";
import VolunteerDetailPanel from "./sections/volunteers/VolunteerDetailPanel";
import TaskFormPanel from "./sections/volunteers/tasks/TaskFormPanel";
import TaskDetailPanel from "./sections/volunteers/tasks/TaskDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";

const PAGE_SIZE = 20;

type StatusFilter = VolunteerAccountStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Banned", label: "Banned" },
  { value: "Deactivated", label: "Deactivated" },
];

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const sectionHeadingClass =
  "mb-4 flex items-center gap-2 font-display text-2xl text-neutral-dark";

type TaskStatusFilter = TaskStatus | "all";

const TASK_STATUS_OPTIONS: { value: TaskStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "In_progress", label: "Assigned" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

type DueFilter = "all" | "today" | "week" | "overdue";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "overdue", label: "Overdue" },
];

// Due-date range in the viewer's own timezone (so "today" means their
// today, not the server's). "This week" is the Monday–Sunday week
// containing today.
const dueRangeParams = (dueFilter: DueFilter) => {
  if (dueFilter === "overdue") return { overdue: true };
  if (dueFilter === "all") return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (dueFilter === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + (dueFilter === "week" ? 7 : 1));
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
};

const TASK_ROW_BG: Record<TaskDisplayStatus, string> = {
  In_progress: "bg-gold-lightest",
  Overdue: "bg-rose-lightest",
  Completed: "bg-neutral-lightgray",
  Cancelled: "bg-neutral-lightgray",
};

type TaskFormState = { mode: "create" } | { mode: "edit"; task: Task };

const contactLines = (volunteer: VolunteerListItem): RowLine[] => [
  {
    text: volunteer.volunteerPhone ? (
      <PhoneDisplay value={volunteer.volunteerPhone} />
    ) : (
      "No phone"
    ),
  },
  { text: volunteer.volunteerEmail },
];

// Volunteers tab — Volunteer Approvals (Pending registrations at this
// shelter; Approve inline, Decline behind a confirm via DashboardActionList),
// All Volunteers (status filter + name search, paginated), whose rows open
// VolunteerDetailPanel, and Tasks (status/due/volunteer-name filters), whose
// rows open TaskDetailPanel. "+ Create Task" opens TaskFormPanel; the detail
// panel's Edit swaps itself for the same form in edit mode, and closing the
// form returns to that task's details (same flow as Appointments.tsx).
const Volunteers = () => {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["staff", "volunteers", "pending"],
    queryFn: () => getVolunteers({ accountStatus: "Pending", limit: 100 }),
  });
  const pendingVolunteers = pendingQuery.data?.data ?? [];

  const approve = useMutation({
    mutationFn: (userID: number) => updateVolunteerStatus(userID, "Active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "volunteers"] });
      toast.success("Volunteer approved");
    },
    onError: () => toast.error("Couldn't approve this volunteer. Please try again."),
  });

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [name, setName] = useState("");

  const listQuery = useQuery({
    queryKey: ["staff", "volunteers", "list", { page, statusFilter, name }],
    queryFn: () =>
      getVolunteers({
        accountStatus: statusFilter === "all" ? undefined : statusFilter,
        name: name || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const volunteers = listQuery.data?.data ?? [];

  const [taskForm, setTaskForm] = useState<TaskFormState | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const closeTaskForm = () => {
    if (taskForm?.mode === "edit") setOpenTaskId(taskForm.task.taskID);
    setTaskForm(null);
  };

  const [taskPage, setTaskPage] = useState(1);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [taskVolunteerName, setTaskVolunteerName] = useState("");

  const tasksQuery = useQuery({
    queryKey: [
      "staff",
      "tasks",
      { taskPage, taskStatusFilter, dueFilter, taskVolunteerName },
    ],
    queryFn: () =>
      getTasks({
        taskStatus: taskStatusFilter === "all" ? undefined : taskStatusFilter,
        ...dueRangeParams(dueFilter),
        volunteerName: taskVolunteerName || undefined,
        page: taskPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const tasks = tasksQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Volunteers"
        emoji="🙌"
        message="Manage volunteers and tasks at your shelter"
        action={{
          label: "Create Task",
          icon: <FaPlus aria-hidden />,
          onClick: () => setTaskForm({ mode: "create" }),
        }}
      />

      <Card className="mb-6 p-6">
        <h2 className={sectionHeadingClass}>🧑‍💼 Volunteer Approvals</h2>

        {pendingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pendingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load pending volunteers. Please try again.
          </p>
        )}
        {pendingQuery.data && pendingVolunteers.length === 0 && (
          <DashboardEmptyMessage>No volunteers awaiting approval.</DashboardEmptyMessage>
        )}

        {pendingVolunteers.length > 0 && (
          <DashboardActionList
            items={pendingVolunteers}
            getKey={(volunteer) => volunteer.userID}
            renderRow={(volunteer, confirm) => (
              <DashboardListRow
                title={volunteer.volunteerName}
                lines={contactLines(volunteer)}
                actions={
                  <>
                    <RowActionButton
                      variant="success"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(volunteer.userID)}
                    >
                      Approve
                    </RowActionButton>
                    <RowActionButton
                      variant="danger"
                      onClick={() => confirm(volunteer)}
                    >
                      Decline
                    </RowActionButton>
                  </>
                }
              />
            )}
            confirmAction={{
              mutationFn: (volunteer) =>
                updateVolunteerStatus(volunteer.userID, "Deactivated"),
              invalidateKeys: [["staff", "volunteers"]],
              successToast: "Volunteer declined",
              errorToast: "Couldn't decline this volunteer. Please try again.",
              modalTitle: "Decline this volunteer?",
              confirmLabel: "Decline",
              renderBody: (volunteer) => (
                <>
                  This declines {volunteer.volunteerName}'s registration and
                  deactivates their account.
                </>
              ),
            }}
          />
        )}
      </Card>

      <Card className="p-6">
        <h2 className={sectionHeadingClass}>🧑‍💼 All Volunteers</h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Account Status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v as StatusFilter);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="volunteer-name">
              Volunteer Name
            </label>
            <input
              id="volunteer-name"
              placeholder="Search by volunteer name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {listQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {listQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load volunteers. Please try again.
          </p>
        )}
        {listQuery.data && volunteers.length === 0 && (
          <DashboardEmptyMessage>No volunteers match your filters.</DashboardEmptyMessage>
        )}

        {volunteers.length > 0 && (
          <ul className="flex flex-col gap-4">
            {volunteers.map((volunteer) => (
              <li key={volunteer.userID}>
                <DashboardListRow
                  title={volunteer.volunteerName}
                  lines={contactLines(volunteer)}
                  badge={{
                    label: volunteer.accountStatus,
                    tone: VOLUNTEER_STATUS_TONE[volunteer.accountStatus],
                  }}
                  actions={
                    <RowActionButton onClick={() => setOpenId(volunteer.userID)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={page}
          totalPages={listQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <Card className="mt-6 p-6">
        <h2 className={sectionHeadingClass}>✅ Tasks</h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Status"
            value={taskStatusFilter}
            onChange={(v) => {
              setTaskStatusFilter(v as TaskStatusFilter);
              setTaskPage(1);
            }}
            options={TASK_STATUS_OPTIONS}
          />
          <SelectField
            label="Due Date"
            value={dueFilter}
            onChange={(v) => {
              setDueFilter(v as DueFilter);
              setTaskPage(1);
            }}
            options={DUE_OPTIONS}
          />
          <div>
            <label className={filterLabelClass} htmlFor="task-volunteer-name">
              Volunteer Name
            </label>
            <input
              id="task-volunteer-name"
              placeholder="Search by volunteer name"
              value={taskVolunteerName}
              onChange={(e) => {
                setTaskVolunteerName(e.target.value);
                setTaskPage(1);
              }}
              className={filterInputClass}
            />
          </div>
        </div>

        {tasksQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {tasksQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load tasks. Please try again.
          </p>
        )}
        {tasksQuery.data && tasks.length === 0 && (
          <DashboardEmptyMessage>No tasks match your filters.</DashboardEmptyMessage>
        )}

        {tasks.length > 0 && (
          <ul className="flex flex-col gap-4">
            {tasks.map((task) => (
              <li key={task.taskID}>
                <DashboardListRow
                  className={TASK_ROW_BG[task.status]}
                  title={`${TASK_NAME_LABEL[task.taskName]} - ${task.volunteers
                    .map((v) => v.volunteerName)
                    .join(", ")}`}
                  lines={[
                    { text: `Description: ${task.taskDesc}`, strong: true },
                    {
                      text: task.taskDue
                        ? `Due: ${formatShortDate(new Date(task.taskDue))}, ${formatTime(
                            new Date(task.taskDue),
                          )}`
                        : "Due: —",
                      strong: true,
                    },
                  ]}
                  badge={{
                    label: TASK_STATUS_LABEL[task.status],
                    tone: TASK_STATUS_TONE[task.status],
                  }}
                  actions={
                    <RowActionButton onClick={() => setOpenTaskId(task.taskID)}>
                      View Details
                    </RowActionButton>
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={taskPage}
          totalPages={tasksQuery.data?.pagination.totalPages ?? 1}
          onChange={setTaskPage}
        />
      </Card>

      <VolunteerDetailPanel userID={openId} onClose={() => setOpenId(null)} />

      {/* key remounts the form per target, so it seeds fresh from `task`. */}
      <TaskFormPanel
        key={taskForm?.mode === "edit" ? taskForm.task.taskID : "create"}
        open={taskForm !== null}
        task={taskForm?.mode === "edit" ? taskForm.task : null}
        onClose={closeTaskForm}
      />

      <TaskDetailPanel
        taskID={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onEdit={(task) => {
          setOpenTaskId(null);
          setTaskForm({ mode: "edit", task });
        }}
      />
    </div>
  );
};

export default Volunteers;
