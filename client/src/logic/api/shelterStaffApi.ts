// shelterStaffApi.ts
// Shelter-manager staff management (Management → Staff tab) —
// /staff/me/team. Every call is restricted server-side to the shelter the
// caller manages (403 for anyone else).
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { StaffAccountStatus, StaffDesignation } from "./staffApi";

export interface ShelterStaffMember {
  userID: number;
  avatarSeed: string;
  staffName: string;
  staffEmail: string;
  staffPhone: string | null;
  staffDOB: string | null;
  staffSex: "M" | "F" | null;
  staffDesignation: StaffDesignation | null;
  staffDOJ: string | null; // Date of Joining — set on first approval
  staffDOS: string | null; // Date of Separation — set on deactivation
  accountStatus: StaffAccountStatus;
}

interface ShelterStaffParams {
  section: "all" | "pending"; // pending = awaiting approval
  staffDesignation?: StaffDesignation;
  name?: string;
  page?: number;
  limit?: number;
}

export const getShelterStaffMembers = async (
  params: ShelterStaffParams,
): Promise<{ data: ShelterStaffMember[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/staff/me/team", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Only Senior/Associate — Manager is Admin-controlled.
export type AssignableDesignation = "Senior" | "Associate";

export const updateShelterStaffDesignation = async (
  userID: number,
  staffDesignation: AssignableDesignation,
): Promise<ShelterStaffMember> => {
  const response = await axiosInstance.patch(`/staff/me/team/${userID}`, {
    staffDesignation,
  });
  return response.data.data;
};

// Pending → Active (approve) / Deactivated (decline); Active → Deactivated.
// Staff sign up with no designation — approving sets it, so it's required
// then (Senior/Associate).
export const updateShelterStaffStatus = async (
  userID: number,
  accountStatus: "Active" | "Deactivated",
  staffDesignation?: AssignableDesignation,
): Promise<ShelterStaffMember> => {
  const response = await axiosInstance.patch(
    `/staff/me/team/${userID}/status`,
    {
      accountStatus,
      staffDesignation,
    },
  );
  return response.data.data;
};
