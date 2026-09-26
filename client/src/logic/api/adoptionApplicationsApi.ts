// What it does: API functions for the /adoption-applications domain —
// distinct base path from /adopters/me/..., so it gets its own file.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

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
  paymentStatus: "Paid";
  amountPaid: number;
  createdAt: string;
  pet?: { petName: string };
}

// Shape returned by the withdraw endpoint — adds the shelter name alongside
// the pet name.
export interface AdoptionApplicationDetail extends AdoptionApplication {
  shelter?: { shelterName: string };
}

// Richer shape from GET /adoption-applications/:id — for the Applications
// section's detail slide-over.
export interface AdoptionApplicationFullDetail {
  applicationID: number;
  applicationCode: string; // e.g. "APP-00123"
  petID: number;
  adopterID: number;
  shelterID: number;
  staffID: number | null;
  applicationStatus: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  applicationType: "Adopt" | "Foster";
  shelterMessage: string | null;
  staffRemark: string | null;
  paymentStatus: "Paid";
  amountPaid: number;
  createdAt: string;
  pet: {
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  };
  shelter: { shelterName: string };
  assignedStaffName: string | null;
  // Only meaningful when Staff/Admin views someone else's application (it's
  // otherwise just an adopter's own name/email reflected back to them).
  adopter: {
    adopterName: string;
    adopterEmail: string;
    adopterPhone: string | null;
    housingType: string | null;
    ownsOrRents: string | null;
    landlordContact: string | null;
    householdSize: number | null;
    numChildren: number | null;
    preQualifyFlag: boolean;
  };
  // Staff/Admin only — null for an Adopter viewing their own application, or
  // if no government ID has been submitted yet. No idType/idNumber here
  // (see CLAUDE.md's "Never expose ... governmentID" rule) — the full
  // record lives in the dedicated ID Verification tab.
  governmentIdStatus: "Pending" | "Verified" | "Rejected" | null;
  // Server-computed: true only for the application's shelter manager (or
  // Admin) while it's still Pending — gates assignApplicationStaff.
  canAssignStaff: boolean;
}

// Starts payment — creates a Stripe Checkout Session and returns its URL.
// Does NOT create the application row; that only happens once the Stripe
// webhook confirms payment (see server/.../adoptionApplications.service.js
// finalizeApplication). Redirect the browser to checkoutUrl on success.
export const createCheckoutSession = async (
  payload: CreateApplicationPayload,
): Promise<{ checkoutUrl: string }> => {
  const response = await axiosInstance.post("/adoption-applications", payload);
  return response.data.data;
};

// Polling read for the post-payment confirmation page — null while the
// webhook hasn't landed yet (the expected, common answer for a poll), not
// an error.
export const getApplicationByCheckoutSession = async (
  checkoutSessionId: string,
): Promise<AdoptionApplication | null> => {
  const response = await axiosInstance.get("/adoption-applications", {
    params: { checkoutSessionId },
  });
  return response.data.data;
};

// Full detail for one application the adopter owns — powers the Applications
// section's detail slide-over (opened via a row's "View Details", or deep-linked
// via ?applicationID= from the Overview widget).
export const getApplicationById = async (
  applicationID: number,
): Promise<AdoptionApplicationFullDetail> => {
  const response = await axiosInstance.get(
    `/adoption-applications/${applicationID}`,
  );
  return response.data.data;
};

// Row shape for the Staff/Admin-scoped queue (GET /adoption-applications
// without checkoutSessionId) — distinct from the adopter's own list, since
// staff review applications from many different adopters and need adopter
// summary fields the adopter's own list has no reason to include.
export interface AdoptionApplicationQueueItem {
  applicationID: number;
  applicationCode: string | null;
  petID: number;
  adopterID: number;
  shelterID: number;
  staffID: number | null;
  applicationStatus: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  applicationType: "Adopt" | "Foster";
  createdAt: string;
  pet: {
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  };
  adopter: { adopterName: string; adopterEmail: string };
}

interface ApplicationsQueueParams {
  // "active" = Pending (needs a decision); "past" = Accepted/Rejected/
  // Withdrawn — same Active/Past split as the Transfers/Appointments tabs.
  section: "active" | "past";
  species?: number[];
  adopterName?: string;
  petName?: string;
  shelterID?: number; // Admin only — Staff is always scoped server-side to their own shelter
  page?: number;
  limit?: number;
}

// Staff/Admin only. Staff sees only their own shelter's applications
// (re-fetched server-side from the STAFF table, never a query param here);
// Admin sees all, optionally filtered by shelterID. Minimal wrapper for now
// (e.g. the Overview stat tile just needs pagination.total) — the full
// Applications tab reuses this same function.
export const getApplicationsQueue = async (
  params: ApplicationsQueueParams,
): Promise<{ data: AdoptionApplicationQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/adoption-applications", {
    params,
  });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Adopter-initiated withdraw — the only status change this endpoint accepts
// from an adopter. The $15 processing fee is not refunded; re-applying for the
// same pet is allowed afterwards.
export const withdrawApplication = async (
  applicationID: number,
): Promise<AdoptionApplicationDetail> => {
  const response = await axiosInstance.patch(
    `/adoption-applications/${applicationID}/status`,
    { status: "Withdrawn" },
  );
  return response.data.data;
};

// Staff/Admin review — only valid on a Pending application. Accepting also
// marks the pet's own adoptionStatus "adopted" server-side in the same
// transaction; Rejecting leaves the pet untouched. staffRemark is optional
// on either transition.
export type StaffReviewStatus = "Accepted" | "Rejected";

export const reviewApplication = async (
  applicationID: number,
  { status, staffRemark }: { status: StaffReviewStatus; staffRemark?: string },
): Promise<AdoptionApplicationDetail> => {
  const response = await axiosInstance.patch(
    `/adoption-applications/${applicationID}/status`,
    { status, staffRemark },
  );
  return response.data.data;
};

// Manager-only (or Admin) — sets the application's assigned staff member.
// Only valid on a Pending application, and only to an Active staff member
// at its shelter. Returns the refreshed full detail.
export const assignApplicationStaff = async (
  applicationID: number,
  staffID: number,
): Promise<AdoptionApplicationFullDetail> => {
  const response = await axiosInstance.patch(
    `/adoption-applications/${applicationID}`,
    { staffID },
  );
  return response.data.data;
};
