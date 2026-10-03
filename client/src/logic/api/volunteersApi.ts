// volunteersApi.ts
// The volunteer's own account — /volunteers/me (profile, onboarding,
// government ID). Same "my profile" shape as vetsApi.ts: a Pending
// volunteer onboards before staff at their shelter approve them. Staff's
// view of volunteers is shelterVolunteersApi.ts.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Task, TaskStatus } from "./tasksApi";
import type { EventListItem } from "./eventsApi";
import type { AppointmentQueueItem } from "./staffAppointmentsApi";
import type { Address } from "../utils/address";
import type { Availability } from "../utils/availability";
import type { VolunteerAccountStatus } from "./shelterVolunteersApi";
import { makeSelfGovernmentIdApi } from "./selfGovernmentIdApi";

export interface VolunteerSelfProfile extends Address {
  userID: number;
  volunteerCode: string | null;
  avatarSeed: string;
  volunteerName: string;
  volunteerPhone: string | null;
  shelterID: number | null;
  volunteerDOB: string | null;
  volunteerSex: string | null;
  // As stored; read `availability` (null = older free text, see
  // logic/utils/availability.ts).
  volunteerSchedule: string | null;
  availability: Availability | null;
  createdAt: string;
  accountStatus: VolunteerAccountStatus | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  shelter: {
    shelterName: string;
    shelterAddress: string;
    shelterPhone: string;
    shelterEmail: string;
  } | null;
  user: { userEmail: string };
  emailVerified: boolean;
  lastLoginAt: string | null;
}

export const getMyVolunteerProfile = async (): Promise<VolunteerSelfProfile> => {
  const response = await axiosInstance.get("/volunteers/me");
  return response.data.data;
};

// Partial update — avatarSeed, volunteerName, volunteerPhone, volunteerDOB,
// volunteerSex and the address fields. shelterID/accountStatus are rejected
// (400). volunteerPhone is normalized server-side to E.164; volunteerSex
// must be M/F/O; phone/DOB/sex accept null to clear them.
export const updateMyVolunteerProfile = async (
  payload: Record<string, unknown>,
): Promise<VolunteerSelfProfile> => {
  const response = await axiosInstance.put("/volunteers/me", payload);
  return response.data.data;
};

// Replaces the whole week — days left out are unavailable, `{}` clears it.
// Unknown days/slots are 400. Not available to a Pending volunteer.
export const updateMyVolunteerAvailability = async (
  availability: Availability,
): Promise<VolunteerSelfProfile> => {
  const response = await axiosInstance.put("/volunteers/me/availability", {
    availability,
  });
  return response.data.data;
};

// ———————————————— CLOSE ACCOUNT ————————————————
// 'deactivate' keeps the row; 'delete' removes it for good. Either way the
// volunteer comes off events that haven't happened yet. 409 (either mode)
// while they're assisting an upcoming appointment or have an open task —
// error.details.blockers lists which (CloseAccountBlocker).
export type VolunteerCloseAccountMode = "deactivate" | "delete";
export type CloseAccountBlocker = "appointments" | "tasks";

export const closeMyVolunteerAccount = async (
  mode: VolunteerCloseAccountMode,
): Promise<void> => {
  await axiosInstance.delete("/volunteers/me", { data: { mode } });
};

// ———————————————— ONBOARDING API ————————————————
// Same wizard as staff and vets: Step 2 Personal, 3 Address, 4 Identity,
// 5 Review. `step` is the step just completed; onboardingStep only ever
// advances.
export const advanceMyVolunteerOnboardingStep = async (
  step: number,
): Promise<VolunteerSelfProfile> => {
  const response = await axiosInstance.patch("/volunteers/me/onboarding-step", {
    step,
  });
  return response.data.data;
};

// Review step's Submit. 409 (naming what's missing) unless phone, DOB, sex,
// address and a submitted government ID are all present.
export const completeMyVolunteerOnboarding = async (): Promise<VolunteerSelfProfile> => {
  const response = await axiosInstance.patch("/volunteers/me/onboarding-complete");
  return response.data.data;
};

// ———————————————— GOVERNMENT ID API ————————————————
export const volunteerGovernmentIdApi = makeSelfGovernmentIdApi(
  "/volunteers/me/government-id",
  ["volunteer", "government-id"],
);

// ———————————————— MY TASKS / EVENTS / APPOINTMENTS ————————————————
// Plain authenticate on the server: none of these work for a Pending
// volunteer (they're held on /volunteer/pending until approved).

interface MyTasksParams {
  taskStatus?: TaskStatus;
  // true → due now or later (or no due date), soonest first; false → due
  // date passed, most recent first; omitted → every task, soonest due first.
  upcoming?: boolean;
  page?: number;
  limit?: number;
}

// Same Task shape (and derived Overdue status) as the staff GET /tasks.
export const getMyVolunteerTasks = async (
  params?: MyTasksParams,
): Promise<{ data: Task[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/volunteers/me/tasks", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// The only transition a volunteer makes — In_progress (overdue included)
// → Completed; anything else is 409, and a task they aren't on is 404.
export const completeMyVolunteerTask = async (taskID: number): Promise<Task> => {
  const response = await axiosInstance.patch(`/volunteers/me/tasks/${taskID}/status`, {
    taskStatus: "Completed",
  });
  return response.data.data;
};

// Every event at the volunteer's shelter — read-only (staff assign
// volunteers), `assigned` says whether this volunteer is on it.
export interface MyVolunteerEvent extends EventListItem {
  assigned: boolean;
}

interface MyEventsParams {
  // true → not started yet, soonest first; false → already started, most
  // recent first; omitted → every event, soonest first.
  upcoming?: boolean;
  assigned?: boolean;
  // Inclusive upper bound on eventDate (ISO) — with upcoming, "now → dateTo".
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const getMyVolunteerEvents = async (
  params?: MyEventsParams,
): Promise<{ data: MyVolunteerEvent[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/volunteers/me/events", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

interface MyAppointmentsParams {
  // true → Scheduled and still ahead, soonest first; false (the server's
  // default) → past or Cancelled, most recent first.
  upcoming?: boolean;
  page?: number;
  limit?: number;
}

// The vet appointments staff assigned this volunteer to assist — read-only,
// same item shape and status labels as GET /vets/me/appointments.
export const getMyVolunteerAppointments = async (
  params?: MyAppointmentsParams,
): Promise<{ data: AppointmentQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/volunteers/me/appointments", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};
