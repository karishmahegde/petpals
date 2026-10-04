// shelterVolunteersApi.ts
// Staff-facing volunteer management — GET /volunteers (scoped server-side to
// the caller's shelter), GET /volunteers/:id, PATCH /volunteers/:id/status.
// A volunteer's own /volunteers/me calls are in volunteersApi.ts (same split
// as shelterVetsApi.ts / vetsApi.ts).
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";
import type { Availability } from "../utils/availability";
import type { GovernmentIdStatus } from "./staffApi";

export type VolunteerAccountStatus =
  "Pending" | "Active" | "Banned" | "Deactivated";

// Row shape for GET /volunteers.
export interface VolunteerListItem {
  userID: number;
  volunteerName: string;
  volunteerPhone: string | null;
  volunteerEmail: string;
  accountStatus: VolunteerAccountStatus;
  // Approval readiness — approving a Pending volunteer needs both
  // (logic/staff/approvalReadiness.ts). governmentIdStatus is null when no
  // ID has been submitted.
  onboardingComplete: boolean;
  governmentIdStatus: GovernmentIdStatus | null;
}

// Every Volunteer column, plus login email, government ID type and masked
// number, and the decoded weekly availability.
export interface VolunteerDetail extends Address {
  userID: number;
  volunteerCode: string | null;
  avatarSeed: string;
  volunteerName: string;
  volunteerPhone: string | null;
  volunteerDOB: string | null;
  volunteerSex: string | null;
  // As stored — read `availability` instead; this is only for older free
  // text that predates structured availability (availability null).
  volunteerSchedule: string | null;
  availability: Availability | null;
  shelterID: number | null;
  shelterName: string | null;
  createdAt: string;
  accountStatus: VolunteerAccountStatus;
  onboardingComplete: boolean;
  onboardingStep: number;
  volunteerEmail: string;
  governmentID: { idType: string; idNumber: string } | null; // idNumber masked, e.g. ****4567
  governmentIdStatus: GovernmentIdStatus | null;
}

interface VolunteersParams {
  accountStatus?: VolunteerAccountStatus;
  name?: string;
  page?: number;
  limit?: number;
}

export const getVolunteers = async (
  params: VolunteersParams,
): Promise<{ data: VolunteerListItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/volunteers", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getVolunteerDetail = async (
  userID: number,
): Promise<VolunteerDetail> => {
  const response = await axiosInstance.get(`/volunteers/${userID}`);
  return response.data.data;
};

// Pending → Active (approve) / Deactivated (decline); Active → Deactivated.
export type VolunteerStatusTarget = "Active" | "Deactivated";

export const updateVolunteerStatus = async (
  userID: number,
  accountStatus: VolunteerStatusTarget,
): Promise<VolunteerDetail> => {
  const response = await axiosInstance.patch(`/volunteers/${userID}/status`, {
    accountStatus,
  });
  return response.data.data;
};
