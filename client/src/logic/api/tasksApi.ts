// tasksApi.ts
// Staff-facing volunteer tasks — GET/POST /tasks, GET/PATCH /tasks/:id,
// PATCH /tasks/:id/status. Scoped server-side to the caller's shelter.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type TaskStatus = "In_progress" | "Completed" | "Cancelled";

// The TaskName enum's stored values — display labels are TASK_NAME_LABEL
// in logic/staff/tasks.ts.
export type TaskName =
  | "Animal_Care"
  | "Vet_Assistance"
  | "Cleaning"
  | "Feeding"
  | "Events"
  | "Admin"
  | "Other";
// `status` adds the derived Overdue (In_progress and past due).
export type TaskDisplayStatus = TaskStatus | "Overdue";

export interface Task {
  taskID: number;
  taskName: TaskName;
  taskDesc: string;
  taskDate: string | null;
  taskDue: string | null;
  taskStatus: TaskStatus;
  status: TaskDisplayStatus;
  staffName: string | null;
  volunteers: { volunteerID: number; volunteerName: string }[];
}

interface TasksParams {
  taskStatus?: TaskStatus;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  volunteerName?: string;
  page?: number;
  limit?: number;
}

export const getTasks = async (
  params: TasksParams,
): Promise<{ data: Task[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/tasks", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getTask = async (taskID: number): Promise<Task> => {
  const response = await axiosInstance.get(`/tasks/${taskID}`);
  return response.data.data;
};

export interface CreateTaskPayload {
  taskName: TaskName;
  taskDesc: string;
  taskDue: string;
  volunteerIDs: number[];
}

export const createTask = async (payload: CreateTaskPayload): Promise<Task> => {
  const response = await axiosInstance.post("/tasks", payload);
  return response.data.data;
};

// Open tasks only; volunteerIDs replaces the whole assignee set.
export const updateTask = async (
  taskID: number,
  payload: Partial<CreateTaskPayload>,
): Promise<Task> => {
  const response = await axiosInstance.patch(`/tasks/${taskID}`, payload);
  return response.data.data;
};

export type TaskStatusTarget = "Completed" | "Cancelled";

export const updateTaskStatus = async (
  taskID: number,
  taskStatus: TaskStatusTarget,
): Promise<Task> => {
  const response = await axiosInstance.patch(`/tasks/${taskID}/status`, {
    taskStatus,
  });
  return response.data.data;
};
