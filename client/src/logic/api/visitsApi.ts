// What it does: API functions for the /visits domain — distinct base path from
// /adopters/me/visits (which lists them), so it gets its own file, mirroring
// adoptionApplicationsApi.ts.
import axiosInstance from "./axiosInstance";
import type { VisitListItem, VisitStatus } from "./adoptersApi";
import type { Pagination } from "./petsApi";

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

// ———————————————— STAFF/ADMIN VISIT QUEUE (Sprint 5.2) ————————————————
// Row shape for the shelter-wide queue (GET /visits, no shelterID param for
// Staff — resolved server-side to their own shelter). Distinct from
// VisitListItem (an adopter's own visits), since staff review visits booked
// by many different adopters and need the adopter/staff summary fields the
// adopter's own list has no reason to include.
export interface VisitQueueItem {
  visitID: number;
  adopterID: number;
  petID: number | null;
  staffID: number | null;
  shelterID: number;
  visitTime: string;
  remarks: string | null;
  visitStatus: VisitStatus | null;
  pet: { petName: string } | null;
  adopter: { adopterName: string; user: { userEmail: string } };
  // null until a staff member Confirms or Completes the visit.
  staff: { staffName: string } | null;
}

// "Unconfirmed" = no visitStatus set yet (null).
export type VisitStatusFilter = "Unconfirmed" | "Confirmed" | "Completed" | "Cancelled";

interface VisitsQueueParams {
  upcoming?: boolean; // future and not Cancelled
  past?: boolean; // already past OR Cancelled, newest first
  status?: VisitStatusFilter;
  name?: string; // adopter OR assigned staff name
  shelterID?: number; // Admin only — Staff is always scoped server-side to their own shelter
  page?: number;
  limit?: number;
}

export const getVisitsQueue = async (
  params?: VisitsQueueParams,
): Promise<{ data: VisitQueueItem[]; pagination: Pagination }> => {
  const { upcoming, past, ...rest } = params ?? {};
  const response = await axiosInstance.get("/visits", {
    params: {
      ...rest,
      ...(upcoming ? { upcoming: "true" } : {}),
      ...(past ? { past: "true" } : {}),
    },
  });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Staff/Admin transition — Confirmed is only valid from an unconfirmed
// (null-status) visit; Completed is only valid from Confirmed (409
// otherwise). Staff may only act on their own shelter's visits (403
// otherwise) — server-enforced, not repeated here. Returns the updated
// visit in the same (adopter-list) shape as GET /adopters/me/visits, not a
// VisitQueueItem (no adopter/staff join) — callers invalidate the staff
// queue query rather than rendering this response directly.
export type StaffVisitTransition = "Confirmed" | "Completed";

export const updateVisitStatus = async (
  visitID: number,
  visitStatus: StaffVisitTransition,
): Promise<VisitListItem> => {
  const response = await axiosInstance.patch(`/visits/${visitID}`, {
    visitStatus,
  });
  return response.data.data;
};
