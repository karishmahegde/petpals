// What it does: Admin-only staff API — org-wide listing/filtering, detail,
// and designation/shelter reassignment. Also used to populate the
// per-shelter manager-assignment dropdown on the Shelters tab.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type StaffDesignation = "Manager" | "Senior" | "Associate";
// Pending = self-registered, awaiting admin approval. Filter-only — never a
// target an admin sets directly (see StaffAccountStatusTarget below).
export type StaffAccountStatus = "Pending" | "Active" | "Deactivated";
// What PATCH /staff/:id/status actually accepts: Active approves a Pending
// account (or reactivates), Deactivated declines/deactivates. There's no
// endpoint to manually revert someone back to Pending.
export type StaffAccountStatusTarget = "Active" | "Deactivated";

export interface StaffListItem {
  userID: number;
  avatarSeed: string;
  staffName: string;
  staffPhone: string | null;
  shelterID: number | null;
  staffDOB: string | null;
  staffSex: string | null;
  staffDOJ: string | null;
  staffDOS: string | null;
  staffDesignation: StaffDesignation | null;
  accountStatus: StaffAccountStatus | null;
  shelter: { shelterName: string } | null;
  user: { userEmail: string };
}

export interface StaffDetail extends StaffListItem {
  // Shelter(s), if any, where this staff member is the currently-assigned manager.
  managedShelters: { shelterID: number; shelterName: string }[];
}

interface StaffListParams {
  shelterID?: number;
  staffDesignation?: string;
  accountStatus?: string;
  page?: number;
  limit?: number;
}

// Lightweight list — used by the Shelters tab's manager-assignment dropdown.
export const getStaff = async (
  params?: StaffListParams,
): Promise<StaffListItem[]> => {
  const response = await axiosInstance.get("/staff", { params });
  return response.data.data;
};

// Same endpoint, pagination kept — used by the Staff tab, which drives
// Prev/Next off it.
export interface PaginatedStaff {
  data: StaffListItem[];
  pagination: Pagination;
}

export const getStaffPage = async (
  params?: StaffListParams,
): Promise<PaginatedStaff> => {
  const response = await axiosInstance.get("/staff", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getStaffDetail = async (userID: number): Promise<StaffDetail> => {
  const response = await axiosInstance.get(`/staff/${userID}`);
  return response.data.data;
};

// Partial update — staffDesignation and/or shelterID only. Account
// activation is a separate endpoint (updateStaffStatus below).
export interface StaffUpdatePayload {
  staffDesignation?: StaffDesignation;
  shelterID?: number;
}

export const updateStaff = async (
  userID: number,
  payload: StaffUpdatePayload,
): Promise<StaffDetail> => {
  const response = await axiosInstance.patch(`/staff/${userID}`, payload);
  return response.data.data;
};

export const updateStaffStatus = async (
  userID: number,
  accountStatus: StaffAccountStatusTarget,
): Promise<StaffDetail> => {
  const response = await axiosInstance.patch(`/staff/${userID}/status`, {
    accountStatus,
  });
  return response.data.data;
};
