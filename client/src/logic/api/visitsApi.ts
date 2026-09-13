// What it does: API functions for the /visits domain — distinct base path from
// /adopters/me/visits (which lists them), so it gets its own file, mirroring
// adoptionApplicationsApi.ts.
import axiosInstance from "./axiosInstance";
import type { VisitListItem, VisitStatus } from "./adoptersApi";

// Full record behind one Visits row — for the detail slide-over
// (GET /visits/:id). Adopter-owned only (403 otherwise).
export interface VisitDetail {
  visitID: number;
  visitTime: string;
  remarks: string | null;
  visitStatus: VisitStatus | null;
  canCancel: boolean;
  pet: {
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  } | null;
  shelterName: string;
  shelterAddress: string;
  assignedStaffName: string | null;
}

export const getVisitById = async (
  visitID: number,
): Promise<VisitDetail> => {
  const response = await axiosInstance.get(`/visits/${visitID}`);
  return response.data.data;
};

// POST /visits — schedules a shelter visit or pet meet-and-greet. petID is
// optional (omit/null for a general shelter visit); visitTime must be an ISO
// datetime in the future. visitStatus is null until staff confirms it, so the
// created row isn't shaped like a VisitListItem (no nested shelter/pet names) —
// callers just invalidate the list query rather than render this directly.
export interface CreateVisitPayload {
  shelterID: number;
  petID?: number | null;
  visitTime: string;
  remarks?: string | null;
}

export interface CreatedVisit {
  visitID: number;
  adopterID: number;
  petID: number | null;
  staffID: number | null;
  shelterID: number;
  visitTime: string;
  remarks: string | null;
  visitStatus: VisitStatus | null;
}

export const createVisit = async (
  payload: CreateVisitPayload,
): Promise<CreatedVisit> => {
  const response = await axiosInstance.post("/visits", payload);
  return response.data.data;
};

// Adopter-initiated cancel — the only status change this endpoint accepts from
// an adopter. Returns the updated visit in the same shape as GET
// /adopters/me/visits.
export const cancelVisit = async (
  visitID: number,
): Promise<VisitListItem> => {
  const response = await axiosInstance.patch(`/visits/${visitID}`, {
    visitStatus: "Cancelled",
  });
  return response.data.data;
};
