// TaskDetailPanel.tsx
// Detail slide-over for one volunteer task — opened from a Tasks row's
// "View Details". Same InfoRow layout as the other staff detail panels.
// While the task is open (In_progress, incl. overdue), the footer stacks
// Edit / Mark Completed / Cancel Task — Complete and Cancel go through a
// ConfirmActionModal (same pendingAction pattern as TransferDetailPanel);
// Edit hands the task up via onEdit and the page opens TaskFormPanel.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../../components/ui/ButtonElement";
import Badge from "../../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../../components/ui/ConfirmActionModal";
import {
  getTask,
  updateTaskStatus,
  type Task,
  type TaskStatusTarget,
} from "../../../../../../../logic/api/tasksApi";
import {
  TASK_NAME_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "../../../../../../../logic/staff/tasks";
import {
  formatFullDate,
  formatTime,
} from "../../../../../../../logic/utils/datetime";

interface TaskDetailPanelProps {
  taskID: number | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const formatDateTime = (iso: string | null) =>
  iso ? `${formatFullDate(new Date(iso))} · ${formatTime(new Date(iso))}` : "—";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const TaskDetailPanel = ({ taskID, onClose, onEdit }: TaskDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<TaskStatusTarget | null>(
    null,
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "task", taskID],
    queryFn: () => getTask(taskID!),
    enabled: taskID !== null,
  });

  const statusMutation = useMutation({
    mutationFn: (taskStatus: TaskStatusTarget) =>
      updateTaskStatus(taskID!, taskStatus),
    onSuccess: (updated, taskStatus) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "tasks"] });
      queryClient.setQueryData(["staff", "task", taskID], updated);
      toast.success(
        taskStatus === "Completed" ? "Task completed" : "Task cancelled",
      );
      setPendingAction(null);
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <>
      <SlideOver
        open={taskID !== null}
        onClose={onClose}
        title="Task Details"
        footer={
          data?.taskStatus === "In_progress" ? (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => onEdit(data)}
                size="panel"
                className="w-full bg-teal-dark hover:brightness-95"
              >
                Edit
              </ButtonElement>
              <ButtonElement
                onClick={() => setPendingAction("Completed")}
                size="panel"
                className="w-full bg-green hover:brightness-95"
              >
                Mark Completed
              </ButtonElement>
              <ButtonElement
                onClick={() => setPendingAction("Cancelled")}
                size="panel"
                className="w-full bg-red hover:brightness-90"
              >
                Cancel Task
              </ButtonElement>
            </div>
          ) : undefined
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading task…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this task. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Task" v={TASK_NAME_LABEL[data.taskName]} />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={TASK_STATUS_TONE[data.status]}>
                  {TASK_STATUS_LABEL[data.status]}
                </Badge>
              </dd>
              <InfoRow
                k="Volunteers"
                v={
                  data.volunteers.map((v) => v.volunteerName).join(", ") || "—"
                }
              />
              <InfoRow k="Description" v={data.taskDesc} />
              <InfoRow k="Due" v={formatDateTime(data.taskDue)} />
              <InfoRow k="Assigned on" v={formatDateTime(data.taskDate)} />
              <InfoRow k="Created by" v={data.staffName ?? "—"} />
            </dl>
          </div>
        )}
      </SlideOver>

      {data && (
        <ConfirmActionModal
          isOpen={pendingAction !== null}
          title={
            pendingAction === "Completed"
              ? "Mark this task completed?"
              : "Cancel this task?"
          }
          confirmLabel={
            pendingAction === "Completed" ? "Mark Completed" : "Cancel Task"
          }
          isPending={statusMutation.isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={() =>
            pendingAction && statusMutation.mutate(pendingAction)
          }
        >
          {pendingAction === "Completed" ? (
            <>
              This marks "{TASK_NAME_LABEL[data.taskName]}" as done. It can't be
              edited afterwards.
            </>
          ) : (
            <>
              This cancels "{TASK_NAME_LABEL[data.taskName]}". It can't be
              edited or completed afterwards.
            </>
          )}
        </ConfirmActionModal>
      )}
    </>
  );
};

export default TaskDetailPanel;
