// shelterVetsApi.ts
// Shelter-manager veterinarian management (Management → Vets tab) —
// /staff/me/vets. Every call is restricted server-side to the shelter the
// caller manages (403 for anyone else). Same shape as shelterStaffApi.ts, minus
// designation (vets have none).
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";

export type VetAccountStatus = "Pending" | "Active" | "Deactivated";

export interface ShelterVet extends Address {
  userID: number;
  avatarSeed: string;
  vetName: string;
  vetEmail: string;
  vetPhone: string | null;
  vetDOB: string | null;
  vetSex: "M" | "F" | null;
  createdAt: string; // when they registered
  accountStatus: VetAccountStatus;
}

interface ShelterVetsParams {
  section: "all" | "pending"; // pending = awaiting approval
  accountStatus?: "Active" | "Deactivated"; // section=all only
  name?: string;
  page?: number;
  limit?: number;
}

export const getShelterVets = async (
  params: ShelterVetsParams,
): Promise<{ data: ShelterVet[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/staff/me/vets", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Pending → Active (approve) / Deactivated (decline); Active → Deactivated.
export const updateShelterVetStatus = async (
  userID: number,
  accountStatus: "Active" | "Deactivated",
): Promise<ShelterVet> => {
  const response = await axiosInstance.patch(
    `/staff/me/vets/${userID}/status`,
    { accountStatus },
  );
  return response.data.data;
};
