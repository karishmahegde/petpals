// volunteersApi.ts
// Staff-facing volunteer management — GET /volunteers (scoped server-side to
// the caller's shelter), GET /volunteers/:id, PATCH /volunteers/:id/status.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";

export type VolunteerAccountStatus =
  "Pending" | "Active" | "Banned" | "Deactivated";

// Row shape for GET /volunteers.
export interface VolunteerListItem {
  userID: number;
  volunteerName: string;
  volunteerPhone: string | null;
  volunteerEmail: string;
  accountStatus: VolunteerAccountStatus;
}

// Every Volunteer column, plus login email and government ID type/number.
export interface VolunteerDetail extends Address {
  userID: number;
  volunteerCode: string | null;
  avatarSeed: string;
  volunteerName: string;
  volunteerPhone: string | null;
  volunteerDOB: string | null;
  volunteerSex: string | null;
  volunteerSchedule: string | null;
  shelterID: number | null;
  shelterName: string | null;
  createdAt: string;
  accountStatus: VolunteerAccountStatus;
  volunteerEmail: string;
  governmentID: { idType: string; idNumber: string } | null;
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
