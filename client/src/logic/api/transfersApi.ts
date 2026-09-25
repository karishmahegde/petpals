// What it does: API functions for the /transfers domain — Staff/Admin-only,
// no adopter-facing surface exists for inter-shelter transfers at all.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type TransferStatus = "In_Progress" | "Completed" | "Rejected" | "Cancelled";

// Row shape for GET /transfers.
export interface TransferQueueItem {
  recordID: number;
  petID: number;
  transferDate: string;
  fromShelterID: number;
  toShelterID: number;
  transferStatus: TransferStatus;
  transferReason: string;
  pet: {
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  };
  fromShelter: { shelterName: string };
  toShelter: { shelterName: string };
}

// Richer shape from GET /transfers/:id — for the Transfers section's detail
// slide-over.
export interface TransferDetail extends TransferQueueItem {
  fromShelterStaff: number | null;
  toShelterStaff: number | null;
  fromStaff: { staffName: string } | null;
  toStaff: { staffName: string } | null;
  // True when the caller is the destination shelter's manager (or Admin) and
  // the transfer is still In_Progress — gates the To-staff reassign select.
  canReassignToShelterStaff: boolean;
  pet: TransferQueueItem["pet"] & {
    petAge: string;
    petSex: string;
    petColor: string;
  };
}

export interface InitiateTransferPayload {
  petID: number;
  toShelterID: number;
  transferReason: string;
  fromShelterID?: number; // Admin only — Staff is always scoped server-side to their own shelter
}

// Only a pet currently "available" at the resolved fromShelterID may be
// transferred (409 otherwise) — on success its adoptionStatus becomes
// "transferred" until the transfer is Approved, Declined, or Cancelled.
export const initiateTransfer = async (
  payload: InitiateTransferPayload,
): Promise<TransferDetail> => {
  const response = await axiosInstance.post("/transfers", payload);
  return response.data.data;
};

export interface TransferStaffOption {
  staffID: number;
  staffName: string;
}

export interface TransferAssignees {
  fromShelterStaff: TransferStaffOption | null;
  toShelterStaff: TransferStaffOption | null;
}

// Preview of what POST /transfers will assign: fromShelterStaff = the
// caller, toShelterStaff = toShelterID's manager (null if it has none, or if
// toShelterID is omitted).
export const getTransferAssignees = async (
  toShelterID?: number,
): Promise<TransferAssignees> => {
  const response = await axiosInstance.get("/transfers/assignees", {
    params: { toShelterID },
  });
  return response.data.data;
};

interface TransfersQueueParams {
  direction: "incoming" | "outgoing";
  status?: TransferStatus;
  shelterName?: string;
  petName?: string;
  shelterID?: number; // Admin only
  page?: number;
  limit?: number;
}

// direction: "incoming" -> transfers where the caller's shelter is the
// destination (Pending Transfers, awaiting this shelter's decision);
// "outgoing" -> transfers this shelter sent (Ongoing Transfers).
export const getTransfersQueue = async (
  params: TransfersQueueParams,
): Promise<{ data: TransferQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/transfers", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getTransferById = async (recordID: number): Promise<TransferDetail> => {
  const response = await axiosInstance.get(`/transfers/${recordID}`);
  return response.data.data;
};

// Completed (approve) / Rejected (decline) may only be set by the
// destination shelter; Cancelled (retract) may only be set by the origin
// shelter. Only valid on an In_Progress transfer.
export type TransferReviewStatus = "Completed" | "Rejected" | "Cancelled";

export const reviewTransfer = async (
  recordID: number,
  status: TransferReviewStatus,
): Promise<TransferDetail> => {
  const response = await axiosInstance.patch(`/transfers/${recordID}/status`, {
    status,
  });
  return response.data.data;
};

// Destination manager (or Admin) only, In_Progress only; the new assignee
// must be an Active staff member at the destination shelter.
export const reassignTransferStaff = async (
  recordID: number,
  toShelterStaff: number,
): Promise<TransferDetail> => {
  const response = await axiosInstance.patch(`/transfers/${recordID}`, {
    toShelterStaff,
  });
  return response.data.data;
};
