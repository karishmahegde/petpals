// donationsApi.ts
// Staff-facing donations (read-only) — GET /donations, /donations/stats,
// /donations/:id, scoped server-side to the caller's shelter.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export interface DonationListItem {
  donationID: number;
  donationCode: string | null;
  donationDate: string;
  donationAmt: number;
  donorName: string | null; // null once the donor has deleted their account
}

export interface DonationDetail {
  donationID: number;
  donationCode: string | null;
  donationDate: string;
  donationAmt: number;
  donationDesc: string | null;
  // null once the donor has deleted their account — the donation stays.
  donor: { donorName: string; donorEmail: string; donorPhone: string | null } | null;
}

// A deleted donor's donations stay on the shelter's books with no donor.
export const FORMER_DONOR = "Former donor";

export interface DonationStats {
  totalAmount: number;
  totalDonors: number;
  thisMonthAmount: number;
}

interface DonationsParams {
  dateFrom?: string;
  dateTo?: string;
  donorName?: string;
  page?: number;
  limit?: number;
}

// Newest first.
export const getDonations = async (
  params: DonationsParams,
): Promise<{ data: DonationListItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/donations", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Over all of the shelter's donations; monthStart = the viewer's local
// start of the current month.
export const getDonationStats = async (monthStart: string): Promise<DonationStats> => {
  const response = await axiosInstance.get("/donations/stats", {
    params: { monthStart },
  });
  return response.data.data;
};

export const getDonation = async (donationID: number): Promise<DonationDetail> => {
  const response = await axiosInstance.get(`/donations/${donationID}`);
  return response.data.data;
};
