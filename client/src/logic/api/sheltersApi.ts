// What it does: Admin-only shelter management API — create, edit, status,
// manager assignment and capacity alerts. The read side (list + status badge
// + utilization) is GET /analytics/shelters — see analyticsApi.ts.
import axiosInstance from "./axiosInstance";

export type ShelterStatus = "Open" | "Full" | "Closed";

export interface Shelter {
  shelterID: number;
  shelterName: string;
  shelterAddress: string;
  shelterPhone: string;
  shelterEmail: string;
  shelterZIP: number;
  shelterSize: number;
  shelterStatus: ShelterStatus;
  managerStaffID: number | null;
  lat: number | null;
  lng: number | null;
}

export interface ShelterCreatePayload {
  shelterName: string;
  shelterAddress: string;
  shelterPhone: string;
  shelterEmail: string;
  shelterZIP: number;
  shelterSize: number;
}

// Partial update — only fields present are changed server-side.
export type ShelterUpdatePayload = Partial<ShelterCreatePayload>;

export const createShelter = async (
  payload: ShelterCreatePayload,
): Promise<Shelter> => {
  const response = await axiosInstance.post("/shelters", payload);
  return response.data.data;
};

export const updateShelter = async (
  shelterID: number,
  payload: ShelterUpdatePayload,
): Promise<Shelter> => {
  const response = await axiosInstance.put(`/shelters/${shelterID}`, payload);
  return response.data.data;
};

export const updateShelterStatus = async (
  shelterID: number,
  shelterStatus: ShelterStatus,
): Promise<Shelter> => {
  const response = await axiosInstance.patch(
    `/shelters/${shelterID}/status`,
    { shelterStatus },
  );
  return response.data.data;
};

export const updateShelterManager = async (
  shelterID: number,
  managerStaffID: number,
): Promise<Shelter> => {
  const response = await axiosInstance.patch(
    `/shelters/${shelterID}/manager`,
    { managerStaffID },
  );
  return response.data.data;
};

export interface CapacityAlertResult {
  managerID: number;
  managerName: string;
}

// Sends the shelter's manager an in-app CapacityAlert notification. 409 when
// the shelter has no manager or the manager's account isn't Active.
export const sendCapacityAlert = async (
  shelterID: number,
): Promise<CapacityAlertResult> => {
  const response = await axiosInstance.post(
    `/shelters/${shelterID}/capacity-alerts`,
  );
  return response.data.data;
};
