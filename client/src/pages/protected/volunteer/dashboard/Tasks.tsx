import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PiCalendarBlank, PiFunnel, PiListChecks } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  type RowLine,
} from "../../../../components/ui/dashboard/DashboardList";
import type { Task, TaskStatus } from "../../../../logic/api/tasksApi";
import {
  completeMyVolunteerTask,
  getMyVolunteerTasks,
} from "../../../../logic/api/volunteersApi";
import { TASK_NAME_LABEL } from "../../../../logic/staff/tasks";
import {
  VOLUNTEER_TASK_STATUS_LABEL,
  VOLUNTEER_TASK_STATUS_TONE,
} from "../../../../logic/volunteer/taskStatus";
import { formatShortDate, formatTime } from "../../../../logic/utils/datetime";

const PAGE_SIZE = 20;

type StatusFilter = "all" | TaskStatus;
type DueFilter = "all" | "upcoming" | "past";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "In_progress", label: "Open" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "Any Due Date" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past Due Date" },
];

const formatDue = (iso: string) => {
  const due = new Date(iso);
  return `${formatShortDate(due)}, ${formatTime(due)}`;
};

// My Tasks tab (/volunteer/tasks) — every task staff have assigned this
// volunteer (GET /volunteers/me/tasks), filtered by status and by due date
// (upcoming = due now or later, or no due date; past = due date passed).
// An open task (overdue included) can be marked Completed after a confirm;
// success invalidates every ["volunteer", "tasks"] query, so the Overview's
// Active Tasks tile and My Tasks widget refresh too.
const Tasks = () => {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [due, setDue] = useState<DueFilter>("all");
  const [page, setPage] = useState(1);

  const tasksQuery = useQuery({
    queryKey: ["volunteer", "tasks", "list", { status, due, page }],
    queryFn: () =>
      getMyVolunteerTasks({
        taskStatus: status === "all" ? undefined : status,
        upcoming: due === "all" ? undefined : due === "upcoming",
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const tasks = tasksQuery.data?.data ?? [];
  const filtered = status !== "all" || due !== "all";

  return (
    <div>
      <DashboardHeading
        title="My Tasks"
        emoji="📋"
        message="Work through the tasks your shelter has assigned you"
        showDate
      />

      <Card className="p-6">
        <DashboardWidgetHeader icon="🗂️" title="Assigned Tasks" className="mb-4" />

        <div className="mb-5 rounded-2xl border border-neutral-lightgray p-4">
          <p className="mb-3 flex items-center gap-1.5 font-body text-base font-semibold text-neutral-dark">
            <PiFunnel aria-hidden /> Filters
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Status"
              icon={<PiListChecks className="text-neutral-gray" />}
              value={status}
              onChange={(v) => {
                setStatus(v as StatusFilter);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <SelectField
              label="Due Date"
              icon={<PiCalendarBlank className="text-neutral-gray" />}
              value={due}
              onChange={(v) => {
                setDue(v as DueFilter);
                setPage(1);
              }}
              options={DUE_OPTIONS}
            />
          </div>
        </div>

        {tasksQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {tasksQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load your tasks. Please try again.
          </p>
        )}
        {tasksQuery.data && tasks.length === 0 && (
          <DashboardEmptyMessage>
            {filtered
              ? "No tasks match your filters."
              : "You haven't been assigned any tasks yet."}
          </DashboardEmptyMessage>
        )}

        {tasks.length > 0 && (
          <DashboardActionList<Task>
            items={tasks}
            getKey={(task) => task.taskID}
            renderRow={(task, confirmComplete) => {
              const lines: RowLine[] = [{ text: task.taskDesc }];
              if (task.taskDue) {
                lines.push({ text: `Due: ${formatDue(task.taskDue)}`, strong: true });
              }
              if (task.staffName) {
                lines.push({ text: `Assigned by ${task.staffName}` });
              }

              return (
                <DashboardListRow
                  className={
                    task.taskStatus === "In_progress"
                      ? "bg-teal-light"
                      : "bg-neutral-lightgray"
                  }
                  title={TASK_NAME_LABEL[task.taskName]}
                  lines={lines}
                  badge={{
                    label: VOLUNTEER_TASK_STATUS_LABEL[task.status],
                    tone: VOLUNTEER_TASK_STATUS_TONE[task.status],
                  }}
                  actions={
                    task.taskStatus === "In_progress" && (
                      <RowActionButton
                        variant="success"
                        onClick={() => confirmComplete(task)}
                      >
                        Mark Completed
                      </RowActionButton>
                    )
                  }
                />
              );
            }}
            confirmAction={{
              mutationFn: (task) => completeMyVolunteerTask(task.taskID),
              invalidateKeys: [["volunteer", "tasks"]],
              successToast: "Task marked as completed",
              errorToast: "Couldn't complete this task. Please try again.",
              modalTitle: "Mark task as completed?",
              confirmLabel: "Mark Completed",
              renderBody: (task) => (
                <p className="font-body text-sm text-neutral-charcoal">
                  <span className="font-semibold">{TASK_NAME_LABEL[task.taskName]}</span>{" "}
                  will show as done to your shelter's staff. This can't be undone from
                  here.
                </p>
              ),
            }}
          />
        )}

        <PaginationControls
          page={page}
          totalPages={tasksQuery.data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>
    </div>
  );
};

export default Tasks;
