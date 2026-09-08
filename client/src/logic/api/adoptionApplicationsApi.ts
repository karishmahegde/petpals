// What it does: API functions for the /adoption-applications domain —
// distinct base path from /adopters/me/..., so it gets its own file.
import axiosInstance from "./axiosInstance";

export interface CreateApplicationPayload {
  petID: number;
  shelterID: number;
  applicationType: "Adopt" | "Foster";
  shelterMessage: string | null;
}

export interface AdoptionApplication {
  applicationID: number;
  petID: number;
  adopterID: number;
  shelterID: number;
  staffID: number | null;
  applicationStatus: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  applicationType: "Adopt" | "Foster";
  shelterMessage: string | null;
  createdAt: string;
}

export const createApplication = async (
  payload: CreateApplicationPayload,
): Promise<AdoptionApplication> => {
  const response = await axiosInstance.post("/adoption-applications", payload);
  return response.data.data;
};
