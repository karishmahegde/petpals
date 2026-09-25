// teamApi.ts
// Shelter-manager staff management (Management → Staff tab) —
// /staff/me/team. Every call is restricted server-side to the shelter the
// caller manages (403 for anyone else).
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { StaffAccountStatus, StaffDesignation } from "./staffApi";

export interface TeamMember {
  userID: number;
  staffName: string;
  staffEmail: string;
  staffPhone: string | null;
  staffDesignation: StaffDesignation | null;
  staffDOJ: string | null;
  accountStatus: StaffAccountStatus;
}

interface TeamParams {
  section: "all" | "pending"; // pending = awaiting approval
  staffDesignation?: StaffDesignation;
  name?: string;
  page?: number;
  limit?: number;
}

export const getTeam = async (
  params: TeamParams,
): Promise<{ data: TeamMember[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/staff/me/team", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Only Senior/Associate — Manager is Admin-controlled.
export type AssignableDesignation = "Senior" | "Associate";

export const updateTeamDesignation = async (
  userID: number,
  staffDesignation: AssignableDesignation,
): Promise<TeamMember> => {
  const response = await axiosInstance.patch(`/staff/me/team/${userID}`, {
    staffDesignation,
  });
  return response.data.data;
};

// Pending → Active (approve) / Deactivated (decline); Active → Deactivated.
export const updateTeamStatus = async (
  userID: number,
  accountStatus: "Active" | "Deactivated",
): Promise<TeamMember> => {
  const response = await axiosInstance.patch(`/staff/me/team/${userID}/status`, {
    accountStatus,
  });
  return response.data.data;
};
