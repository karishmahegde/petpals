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
