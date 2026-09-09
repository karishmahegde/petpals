// What it does: API functions for the /visits domain — distinct base path from
// /adopters/me/visits (which lists them), so it gets its own file, mirroring
// adoptionApplicationsApi.ts.
import axiosInstance from "./axiosInstance";
import type { VisitListItem } from "./adoptersApi";

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
