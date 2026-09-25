// TaskFormPanel.tsx
// "Create Task" form, and the Edit form when `task` is passed (from
// TaskDetailPanel's Edit) — same create/edit split as AppointmentFormPanel:
// the caller remounts this per target via `key`, so the useState
// initialisers are the only seeding needed, and Edit sends only the changed
// fields. Volunteers are this shelter's active volunteers (the same
// getShelterVolunteers roster the appointment form uses), picked via the
// catalog's CheckboxDropdown.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../../components/ui/ButtonElement";
import { CheckboxDropdown } from "../../../../../../../components/ui/pets/FilterControls";
import { getShelterVolunteers } from "../../../../../../../logic/api/staffAppointmentsApi";
import {
  createTask,
  updateTask,
  type CreateTaskPayload,
  type Task,
  type TaskName,
} from "../../../../../../../logic/api/tasksApi";
import { TASK_NAME_LABEL } from "../../../../../../../logic/staff/tasks";
import { toDateTimeLocalValue } from "../../../../../../../logic/utils/datetime";

interface TaskFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode, seeded from this task. */
  task?: Task | null;
}

const MAX_DESC_LEN = 300; // schema.prisma: taskDesc is VarChar(300)

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const sameIDs = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

const TaskFormPanel = ({ open, onClose, task = null }: TaskFormPanelProps) => {
  const queryClient = useQueryClient();
  const isEdit = task !== null;

  // Seed values — empty for create, or the task being edited.
  const initial = {
    taskName: (task?.taskName ?? "") as TaskName | "",
    volunteerIDs: task?.volunteers.map((v) => v.volunteerID) ?? [],
    taskDue: task?.taskDue ? toDateTimeLocalValue(new Date(task.taskDue)) : "",
    taskDesc: task?.taskDesc ?? "",
  };

  const [taskName, setTaskName] = useState(initial.taskName);
  const [volunteerIDs, setVolunteerIDs] = useState<number[]>(
    initial.volunteerIDs,
  );
  const [taskDue, setTaskDue] = useState(initial.taskDue);
  const [taskDesc, setTaskDesc] = useState(initial.taskDesc);

  const { data: volunteers = [] } = useQuery({
    queryKey: ["staff", "shelter-volunteers"],
    queryFn: getShelterVolunteers,
    enabled: open,
  });

  const toggleVolunteer = (id: string | number) => {
    const volunteerID = Number(id);
    setVolunteerIDs((ids) =>
      ids.includes(volunteerID)
        ? ids.filter((v) => v !== volunteerID)
        : [...ids, volunteerID],
    );
  };

  const resetForm = () => {
    setTaskName(initial.taskName);
    setVolunteerIDs(initial.volunteerIDs);
    setTaskDue(initial.taskDue);
    setTaskDesc(initial.taskDesc);
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  // Only what actually changed goes to PATCH.
  const buildChanges = (): Partial<CreateTaskPayload> => {
    const changes: Partial<CreateTaskPayload> = {};
    if (taskName !== initial.taskName && taskName !== "")
      changes.taskName = taskName;
    if (!sameIDs(volunteerIDs, initial.volunteerIDs))
      changes.volunteerIDs = volunteerIDs;
    if (taskDue !== initial.taskDue)
      changes.taskDue = new Date(taskDue).toISOString();
    if (taskDesc.trim() !== initial.taskDesc)
      changes.taskDesc = taskDesc.trim();
    return changes;
  };
  const hasChanges = !isEdit || Object.keys(buildChanges()).length > 0;

  const submit = useMutation({
    mutationFn: () =>
      isEdit
        ? updateTask(task.taskID, buildChanges())
        : createTask({
            taskName: taskName as TaskName,
            volunteerIDs,
            taskDue: new Date(taskDue).toISOString(),
            taskDesc: taskDesc.trim(),
          }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "tasks"] });
      if (isEdit) {
        queryClient.setQueryData(["staff", "task", saved.taskID], saved);
      }
      toast.success(isEdit ? "Task updated" : "Task created");
      closeAndReset();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const canSubmit =
    hasChanges &&
    taskName !== "" &&
    volunteerIDs.length > 0 &&
    taskDue !== "" &&
    taskDesc.trim() !== "" &&
    taskDesc.length <= MAX_DESC_LEN &&
    !submit.isPending;

  return (
    <SlideOver
      open={open}
      onClose={closeAndReset}
      title={isEdit ? "Edit Task" : "Create Task"}
    >
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit.mutate();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="task-name">
            Task
          </label>
          <select
            id="task-name"
            required
            value={taskName}
            onChange={(e) => setTaskName(e.target.value as TaskName | "")}
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {Object.entries(TASK_NAME_LABEL).map(([name, label]) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <CheckboxDropdown
          icon={null}
          label="Volunteers"
          placeholder="- Select -"
          options={volunteers.map((v) => ({
            value: v.volunteerID,
            label: v.volunteerName,
          }))}
          selectedValues={volunteerIDs}
          onToggle={toggleVolunteer}
        />

        <div>
          <label className={labelClass} htmlFor="task-due">
            Due date &amp; time
          </label>
          <input
            id="task-due"
            type="datetime-local"
            required
            value={taskDue}
            onChange={(e) => setTaskDue(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="task-desc">
            Description
          </label>
          <textarea
            id="task-desc"
            required
            rows={3}
            maxLength={MAX_DESC_LEN}
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            className={fieldClass}
          />
        </div>

        <ButtonElement
          type="submit"
          disabled={!canSubmit}
          size="panel"
          className="w-full bg-teal-dark hover:brightness-95 disabled:cursor-not-allowed"
        >
          {isEdit
            ? submit.isPending
              ? "Saving…"
              : "Save Changes"
            : submit.isPending
              ? "Creating…"
              : "Create Task"}
        </ButtonElement>
      </form>
    </SlideOver>
  );
};

export default TaskFormPanel;
