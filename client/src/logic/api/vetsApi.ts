// vetsApi.ts
// The veterinarian's own account — /vets/me (profile, onboarding, government
// ID, close account). Mirrors staffApi.ts's "my profile" half: a Pending vet
// onboards before their shelter manager approves them, and the profile shape
// is the same as /staff/me's so the onboarding screens line up.
import axiosInstance from "./axiosInstance";
import type { Address } from "../utils/address";
import { makeSelfGovernmentIdApi } from "./selfGovernmentIdApi";
import type { Pagination } from "./petsApi";
import type {
  AppointmentQueueItem,
  AppointmentStatus,
} from "./staffAppointmentsApi";
import type {
  HealthPassportData,
  PaginatedStaffPets,
  PetAdoptionStatus,
} from "./staffPetsApi";

export type VetAccountStatus = "Pending" | "Active" | "Deactivated";

export interface VetSelfProfile extends Address {
  userID: number;
  avatarSeed: string;
  vetName: string;
  vetPhone: string | null;
  shelterID: number | null;
  vetDOB: string | null;
  vetSex: string | null;
  createdAt: string;
  accountStatus: VetAccountStatus | null;
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

export const getMyVetProfile = async (): Promise<VetSelfProfile> => {
  const response = await axiosInstance.get("/vets/me");
  return response.data.data;
};

// Partial update — avatarSeed, vetName, vetPhone, vetDOB, vetSex and the
// address fields. shelterID/accountStatus are rejected (400). vetPhone is
// normalized server-side to E.164; vetSex must be M/F/O; vetPhone/vetDOB/
// vetSex accept null to clear them.
export const updateMyVetProfile = async (
  payload: Record<string, unknown>,
): Promise<VetSelfProfile> => {
  const response = await axiosInstance.put("/vets/me", payload);
  return response.data.data;
};

// ———————————————— ONBOARDING API ————————————————
// Same wizard as staff: Step 2 Personal, 3 Address, 4 Identity, 5 Review.
// `step` is the step just completed; onboardingStep only ever advances.
export const advanceMyVetOnboardingStep = async (
  step: number,
): Promise<VetSelfProfile> => {
  const response = await axiosInstance.patch("/vets/me/onboarding-step", {
    step,
  });
  return response.data.data;
};

// Review step's Submit. 409 (naming what's missing) unless phone, DOB, sex,
// address and a submitted government ID are all present.
export const completeMyVetOnboarding = async (): Promise<VetSelfProfile> => {
  const response = await axiosInstance.patch("/vets/me/onboarding-complete");
  return response.data.data;
};

// ———————————————— GOVERNMENT ID API ————————————————
export const vetGovernmentIdApi = makeSelfGovernmentIdApi(
  "/vets/me/government-id",
  ["vet", "government-id"],
);

// ———————————————— CLOSE ACCOUNT ————————————————
// 'deactivate' keeps the row; 'delete' is permanent (the pets' history
// survives with no vet attached). 409 while the vet still has upcoming
// Scheduled appointments.
export type VetCloseAccountMode = "deactivate" | "delete";

export const closeMyVetAccount = async (
  mode: VetCloseAccountMode,
): Promise<void> => {
  await axiosInstance.delete("/vets/me", { data: { mode } });
};

// ———————————————— MY APPOINTMENTS ————————————————
// The vet's own queue (vetID = caller). Same list-item shape as the Staff
// GET /appointments, so the row components can be shared.
// upcoming=true → Scheduled and still in the future, soonest first;
// otherwise past-dated or Cancelled, most recent first.
export interface VetAppointmentsParams {
  upcoming?: boolean;
  petName?: string;
  // Optional inclusive range on appointmentDate (ISO date-times).
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const getMyVetAppointments = async (
  params?: VetAppointmentsParams,
): Promise<{ data: AppointmentQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/vets/me/appointments", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// One of the vet's own appointments — another vet's is a 404. `status` is
// what to display; `appointmentStatus` is the stored value: a past
// Scheduled appointment displays as Completed but can still be completed.
export interface VetAppointmentDetail extends AppointmentQueueItem {
  appointmentCode: string | null;
  appointmentStatus: AppointmentStatus;
  shelterID: number;
  shelterName: string;
  staffName: string | null;
  volunteerName: string | null;
  vaccinesAdministered: {
    recordID: number;
    vaccineName: string;
    administeredDate: string;
    dueDate: string | null; // null = no further dose planned
  }[];
  // Health notes written at this appointment (e.g. on completing it).
  healthRecords: { recordID: number; recordDesc: string; createdAt: string }[];
}

export const getMyVetAppointment = async (
  appointmentID: number,
): Promise<VetAppointmentDetail> => {
  const response = await axiosInstance.get(`/vets/me/appointments/${appointmentID}`);
  return response.data.data;
};

// Mark one of the vet's own appointments Completed. Only from a stored
// Scheduled, and not before its time (409 otherwise). Optional notes (≤500
// chars) become a health record linked to the appointment.
export const completeMyAppointment = async (
  appointmentID: number,
  notes?: string,
): Promise<VetAppointmentDetail> => {
  const response = await axiosInstance.patch(
    `/appointments/${appointmentID}/status`,
    { appointmentStatus: "Completed", ...(notes ? { notes } : {}) },
  );
  return response.data.data;
};

// Reschedule/reword one of the vet's own upcoming appointments
// (PATCH /appointments/:id — the vet may only send these two fields). 409
// if it's no longer Scheduled/upcoming or the new slot is already booked.
export interface UpdateMyAppointmentPayload {
  appointmentDate?: string; // ISO, not in the past
  appointmentReason?: string; // ≤300 chars
}

export const updateMyAppointment = async (
  appointmentID: number,
  payload: UpdateMyAppointmentPayload,
): Promise<VetAppointmentDetail> => {
  const response = await axiosInstance.patch(`/appointments/${appointmentID}`, payload);
  return response.data.data;
};

// ———————————————— MY SHELTER'S PETS ————————————————
// Pets at the vet's shelter — same params and list shape as the Staff
// GET /staff/me/pets, plus petName (case-insensitive contains).
export interface VetPetsParams {
  adoptionStatus?: PetAdoptionStatus;
  species?: number[];
  breed?: string[];
  size?: string[];
  minAge?: string;
  maxAge?: string;
  sort?: "newest";
  petName?: string;
  page?: number;
  limit?: number;
}

export const getMyVetPets = async (
  params?: VetPetsParams,
): Promise<PaginatedStaffPets> => {
  const response = await axiosInstance.get("/vets/me/pets", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Same shape as the Staff health passport. A pet at another shelter is 404.
export const getMyVetPetHealthPassport = async (
  petID: number,
): Promise<HealthPassportData> => {
  const response = await axiosInstance.get(`/vets/me/pets/${petID}/health-passport`);
  return response.data.data;
};

// ———————————————— OVERVIEW ————————————————
// Overdue vaccinations at the vet's shelter: per active pet and vaccine,
// only the latest dose counts. doseNumber is the dose now due. Most overdue
// first.
export interface OverdueVaccination {
  petID: number;
  petName: string;
  petPhoto: string | null;
  vaccineID: number;
  vaccineName: string;
  doseNumber: number;
  dueDate: string;
  daysOverdue: number;
}

export const getMyOverdueVaccinations = async (): Promise<OverdueVaccination[]> => {
  const response = await axiosInstance.get("/vets/me/vaccinations/overdue");
  return response.data.data;
};

// petsTreated — distinct pets the vet has seen at a past, non-cancelled
// appointment.
export interface VetStats {
  petsTreated: number;
}

export const getMyVetStats = async (): Promise<VetStats> => {
  const response = await axiosInstance.get("/vets/me/stats");
  return response.data.data;
};
