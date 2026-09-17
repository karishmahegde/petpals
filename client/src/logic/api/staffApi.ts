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

// ———————————————— MY PROFILE API ————————————————
// Self-service shape — same fields as StaffListItem. Update/close-account/
// government-ID wrappers land with the Staff Profile page's own card.
export const getMyStaffProfile = async (): Promise<StaffListItem> => {
  const response = await axiosInstance.get("/staff/me");
  return response.data.data;
};

// Partial update — avatarSeed, staffName, staffPhone, staffDOB, and/or
// staffSex only. Unlike Admin, Staff has no address field, and
// shelterID/staffDesignation/accountStatus are Admin-controlled (PATCH
// /staff/:id, /staff/:id/status) — the endpoint rejects them here.
// staffPhone must be a valid phone number (normalized server-side to
// E.164); staffSex must be M/F/O. staffPhone/staffDOB/staffSex accept null
// to clear them.
export const updateMyStaffProfile = async (
  payload: Record<string, unknown>,
): Promise<StaffListItem> => {
  const response = await axiosInstance.put("/staff/me", payload);
  return response.data.data;
};

// 'deactivate' keeps the row (no self-service reactivation); 'delete' is
// permanent. Both clear managerStaffID on any shelter this staff member
// manages. No "last active manager" guard — this is self-service on your
// own account. The endpoint does 409 if a Pending application is still
// assigned to this staff member.
export type StaffCloseAccountMode = "deactivate" | "delete";

export const closeMyStaffAccount = async (
  mode: StaffCloseAccountMode,
): Promise<void> => {
  await axiosInstance.delete("/staff/me", { data: { mode } });
};

// ———————————————— GOVERNMENT ID API ————————————————
// Mirrors adminsApi.ts's getMyAdminGovernmentId/uploadMyAdminGovernmentId
// exactly — self-only. Unlike Admin/Adopter, idNumber is masked on BOTH
// GET and POST here (never returned in full on either route) — see
// staff.service.js's createGovernmentId/getGovernmentId.
export interface StaffGovernmentIdRecord {
  governmentIDID: number;
  userID: number;
  userType: string;
  idType: string;
  idNumber: string; // masked — only the last 4 characters, e.g. "*****6789"
  verificationStatus: "Pending" | "Verified" | "Rejected";
  documentURL: string | null;
}

// 404 means no ID has been submitted yet — callers should treat that as a
// normal "not submitted" state, not an error to surface.
export const getMyStaffGovernmentId =
  async (): Promise<StaffGovernmentIdRecord> => {
    const response = await axiosInstance.get("/staff/me/government-id");
    return response.data.data;
  };

export interface UploadStaffGovernmentIdPayload {
  idType: string;
  idNumber: string;
  file: File;
}

// multipart/form-data — one government ID per staff member; a second
// submission is rejected server-side with 409 (unless the existing one was
// Rejected, in which case it's overwritten and reset to Pending).
export const uploadMyStaffGovernmentId = async (
  payload: UploadStaffGovernmentIdPayload,
): Promise<StaffGovernmentIdRecord> => {
  const formData = new FormData();
  formData.append("idType", payload.idType);
  formData.append("idNumber", payload.idNumber);
  formData.append("file", payload.file);
  const response = await axiosInstance.post(
    "/staff/me/government-id",
    formData,
  );
  return response.data.data;
};
