// taskStatus.ts
// Volunteer-facing task status labels and badge tones — the stored
// In_progress reads "Open" to the volunteer (staff see "Assigned", in
// logic/staff/tasks.ts). Overdue is the server's derived status.
import type { BadgeTone } from "../../components/ui/Badge";
import type { TaskDisplayStatus } from "../api/tasksApi";

export const VOLUNTEER_TASK_STATUS_LABEL: Record<TaskDisplayStatus, string> = {
  In_progress: "Open",
  Overdue: "Overdue",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const VOLUNTEER_TASK_STATUS_TONE: Record<TaskDisplayStatus, BadgeTone> = {
  In_progress: "gold",
  Overdue: "red",
  Completed: "green",
  Cancelled: "gray",
};
