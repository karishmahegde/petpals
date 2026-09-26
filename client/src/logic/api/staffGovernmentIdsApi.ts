// What it does: API functions for the /government-ids domain — Staff/Admin
// only. Who sees whose IDs is decided server-side: a shelter's manager →
// Adopter/Volunteer/Staff/Veterinarian, other staff → Adopter/Volunteer, Admin →
// Managers and other Admins. Unlike every
// other place GovernmentID is exposed, getGovernmentIdDetail returns the
// FULL idNumber and a real, viewable document image — this is the
// dedicated, authorized verification workflow those fields exist for.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type GovernmentIdUserType =
  | "Adopter"
  | "Volunteer"
  | "Staff"
  | "Veterinarian"
  | "Admin";
export type GovernmentIdVerificationStatus = "Pending" | "Verified" | "Rejected";

// Row shape for GET /government-ids.
export interface GovernmentIdQueueItem {
  governmentIDID: number;
  userID: number;
  userType: GovernmentIdUserType;
  personName: string;
  personEmail: string | null;
  personAvatarSeed: string | null;
  idType: string;
  verificationStatus: GovernmentIdVerificationStatus;
}

// Richer shape from GET /government-ids/:id — for the detail slide-over.
export interface GovernmentIdDetail extends GovernmentIdQueueItem {
  idNumber: string;
  documentURL: string | null;
}

interface GovernmentIdsQueueParams {
  section: "pending" | "reviewed";
  userType?: GovernmentIdUserType;
  name?: string;
  shelterID?: number; // Admin only
  page?: number;
  limit?: number;
}

export const getGovernmentIdsQueue = async (
  params: GovernmentIdsQueueParams,
): Promise<{ data: GovernmentIdQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/government-ids", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getGovernmentIdDetail = async (
  governmentIDID: number,
): Promise<GovernmentIdDetail> => {
  const response = await axiosInstance.get(`/government-ids/${governmentIDID}`);
  return response.data.data;
};

// Only valid on a Pending record.
export const updateGovernmentIdStatus = async (
  governmentIDID: number,
  verificationStatus: "Verified" | "Rejected",
): Promise<GovernmentIdDetail> => {
  const response = await axiosInstance.patch(
    `/government-ids/${governmentIDID}/status`,
    { verificationStatus },
  );
  return response.data.data;
};
