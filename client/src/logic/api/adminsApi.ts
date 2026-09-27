// What it does: Admin-only admins API — org-wide admin account listing,
// detail, and Activate/Deactivate (also how a Pending self-registered admin
// is approved/declined). Mirrors staffApi.ts, minus the designation/shelter
// fields Admin doesn't have.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";

// Pending = self-registered, awaiting approval by an existing admin.
// Filter-only — never a target an admin sets directly (see
// AdminAccountStatusTarget below).
export type AdminAccountStatus = "Pending" | "Active" | "Deactivated";
// What PATCH /admins/:id/status actually accepts: Active approves a Pending
// account (or reactivates), Deactivated declines/deactivates.
export type AdminAccountStatusTarget = "Active" | "Deactivated";

export interface AdminListItem extends Address {
  userID: number;
  avatarSeed: string;
  adminName: string;
  adminPhone: string | null;
  adminDOB: string | null;
  adminSex: string | null;
  createdAt: string;
  emailVerified: boolean; // from Users (account-level)
  lastLoginAt: string | null; // from Users (account-level)
  accountStatus: AdminAccountStatus | null;
  // Last accountStatus change (approve/decline/activate/deactivate) — not a
  // full history, just the most recent one. Null if never changed since
  // creation, or if the admin who made that change was later deleted.
  statusChangedAt: string | null;
  statusChangedBy: { userID: number; adminName: string } | null;
  user: { userEmail: string };
}

interface AdminListParams {
  accountStatus?: string;
  page?: number;
  limit?: number;
}

// Lightweight list — used by the Admin Approvals section (accountStatus=Pending).
export const getAdmins = async (
  params?: AdminListParams,
): Promise<AdminListItem[]> => {
  const response = await axiosInstance.get("/admins", { params });
  return response.data.data;
};

// Same endpoint, pagination kept — used by the Admins tab, which drives
// Prev/Next off it.
export interface PaginatedAdmins {
  data: AdminListItem[];
  pagination: Pagination;
}

export const getAdminsPage = async (
  params?: AdminListParams,
): Promise<PaginatedAdmins> => {
  const response = await axiosInstance.get("/admins", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getAdminDetail = async (
  userID: number,
): Promise<AdminListItem> => {
  const response = await axiosInstance.get(`/admins/${userID}`);
  return response.data.data;
};

export const updateAdminStatus = async (
  userID: number,
  accountStatus: AdminAccountStatusTarget,
): Promise<AdminListItem> => {
  const response = await axiosInstance.patch(`/admins/${userID}/status`, {
    accountStatus,
  });
  return response.data.data;
};

// ———————————————— MY PROFILE API ————————————————
// Same shape as AdminListItem — Admin has no separate "profile" fields
// beyond what's already on the list/detail rows.
export const getMyAdminProfile = async (): Promise<AdminListItem> => {
  const response = await axiosInstance.get("/admins/me");
  return response.data.data;
};

// Partial update — avatarSeed, adminName, adminPhone, the address fields
// (addressLine1/2, city, state, zip, country), adminDOB, and/or adminSex.
// adminPhone must be a valid phone number (normalized server-side to
// E.164); adminSex must be M/F/O. adminPhone/addressLine2/adminDOB/adminSex
// accept null to clear them; the other address fields clear to "".
export const updateMyAdminProfile = async (
  payload: Record<string, unknown>,
): Promise<AdminListItem> => {
  const response = await axiosInstance.put("/admins/me", payload);
  return response.data.data;
};

// 'deactivate' keeps the row (no self-service reactivation); 'delete' is
// permanent. No "last active Admin" guard, unlike updateAdminStatus above —
// this is self-service on your own account.
export type AdminCloseAccountMode = "deactivate" | "delete";

export const closeMyAdminAccount = async (
  mode: AdminCloseAccountMode,
): Promise<void> => {
  await axiosInstance.delete("/admins/me", { data: { mode } });
};

// ———————————————— GOVERNMENT ID API ————————————————
// Mirrors adoptersApi.ts's getGovernmentId/uploadGovernmentId exactly —
// self-only, never exposed via getAdminDetail to other admins.
export interface AdminGovernmentIdRecord {
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
export const getMyAdminGovernmentId =
  async (): Promise<AdminGovernmentIdRecord> => {
    const response = await axiosInstance.get("/admins/me/government-id");
    return response.data.data;
  };

export interface UploadAdminGovernmentIdPayload {
  idType: string;
  idNumber: string;
  file: File;
}

// multipart/form-data — one government ID per admin; a second submission is
// rejected server-side with 409.
export const uploadMyAdminGovernmentId = async (
  payload: UploadAdminGovernmentIdPayload,
): Promise<AdminGovernmentIdRecord> => {
  const formData = new FormData();
  formData.append("idType", payload.idType);
  formData.append("idNumber", payload.idNumber);
  formData.append("file", payload.file);
  const response = await axiosInstance.post(
    "/admins/me/government-id",
    formData,
  );
  return response.data.data;
};
