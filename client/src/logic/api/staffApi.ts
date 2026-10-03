// What it does: Admin-only staff API — org-wide listing/filtering, detail,
// and designation/shelter reassignment. Also used to populate the
// per-shelter manager-assignment dropdown on the Shelters tab.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";
import {
  makeSelfGovernmentIdApi,
  type GovernmentIdRecord,
  type UploadGovernmentIdPayload,
} from "./selfGovernmentIdApi";

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
  // What an approver checks before approving a Pending sign-up: approval
  // needs onboarding complete AND a Verified government ID (null when none
  // has been submitted). Only the ID's status is ever exposed.
  onboardingComplete: boolean;
  governmentIdStatus: GovernmentIdStatus | null;
}

export type GovernmentIdStatus = "Pending" | "Verified" | "Rejected";

export interface StaffDetail extends StaffListItem {
  // Shelter(s), if any, where this staff member is the currently-assigned manager.
  managedShelters: { shelterID: number; shelterName: string }[];
}

interface StaffListParams {
  shelterID?: number;
  staffDesignation?: string;
  accountStatus?: string;
  /** Only the Pending registrations Admin approves — at shelters with no manager. */
  awaitingAdmin?: boolean;
  /** Case-insensitive contains match on staffName. */
  name?: string;
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
// The self-service shape — the list-row fields plus the address and the
// account-level emailVerified/lastLoginAt (from Users).
export interface StaffSelfProfile
  extends Omit<StaffListItem, "governmentIdStatus">,
    Address {
  emailVerified: boolean;
  lastLoginAt: string | null;
  onboardingStep: number;
}

export const getMyStaffProfile = async (): Promise<StaffSelfProfile> => {
  const response = await axiosInstance.get("/staff/me");
  return response.data.data;
};

// Partial update — avatarSeed, staffName, staffPhone, staffDOB, staffSex
// and the address fields (addressLine1/2, city, state, zip, country).
// shelterID/staffDesignation/accountStatus are Admin-controlled (PATCH
// /staff/:id, /staff/:id/status) — the endpoint rejects them here.
// staffPhone must be a valid phone number (normalized server-side to
// E.164); staffSex must be M/F/O. staffPhone/staffDOB/staffSex accept null
// to clear them.
export const updateMyStaffProfile = async (
  payload: Record<string, unknown>,
): Promise<StaffSelfProfile> => {
  const response = await axiosInstance.put("/staff/me", payload);
  return response.data.data;
};

// ———————————————— ONBOARDING API ————————————————
// A new staff member onboards while still Pending, before approval (Step 2
// Personal, 3 Address, 4 Identity, 5 Review). `step` is the step just
// completed; server-side, onboardingStep only ever advances (max 5).
export const advanceMyStaffOnboardingStep = async (
  step: number,
): Promise<StaffSelfProfile> => {
  const response = await axiosInstance.patch("/staff/me/onboarding-step", {
    step,
  });
  return response.data.data;
};

// Review step's Submit. 409 (with the missing items in its message) unless
// phone, DOB, sex, address and a submitted government ID are all present.
export const completeMyStaffOnboarding =
  async (): Promise<StaffSelfProfile> => {
    const response = await axiosInstance.patch(
      "/staff/me/onboarding-complete",
    );
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
// Built by the shared selfGovernmentIdApi.ts factory (same calls for every
// worker role). idNumber is masked on both GET and POST. The named exports
// below are kept for the existing callers.
export const staffGovernmentIdApi = makeSelfGovernmentIdApi(
  "/staff/me/government-id",
  ["staff", "government-id"],
);
export type StaffGovernmentIdRecord = GovernmentIdRecord;
export type UploadStaffGovernmentIdPayload = UploadGovernmentIdPayload;
export const getMyStaffGovernmentId = staffGovernmentIdApi.get;
export const uploadMyStaffGovernmentId = staffGovernmentIdApi.upload;
