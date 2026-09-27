// tasks.ts
// Volunteer-task constants shared by the Volunteers tab's Tasks section,
// TaskFormPanel and TaskDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { TaskDisplayStatus, TaskName } from "../api/tasksApi";

// Display label per TaskName enum value — also the dropdown's option list
// (in this order).
export const TASK_NAME_LABEL: Record<TaskName, string> = {
  Animal_Care: "Animal Care",
  Vet_Assistance: "Vet Assistance",
  Cleaning: "Cleaning",
  Feeding: "Feeding",
  Events: "Events",
  Admin: "Admin",
  Other: "Other",
};

// Staff-facing labels — the stored In_progress reads as "Assigned".
export const TASK_STATUS_LABEL: Record<TaskDisplayStatus, string> = {
  In_progress: "Assigned",
  Overdue: "Overdue",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const TASK_STATUS_TONE: Record<TaskDisplayStatus, BadgeTone> = {
  In_progress: "gold",
  Overdue: "red",
  Completed: "green",
  Cancelled: "gray",
};
