// donorsApi.ts
// The donor's own account and giving — /donors/me (profile, skippable
// onboarding), POST /donations/checkout (Stripe) and /donors/me/donations
// (history, stats, the confirmation page's poll). Same "my profile" shape as
// volunteersApi.ts, minus the government ID — donors are Active from
// sign-up. Staff's view of donations is donationsApi.ts.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";
import type { Address } from "../utils/address";

export type DonorAccountStatus = "Active" | "Deactivated";

export interface DonorSelfProfile extends Address {
  userID: number;
  avatarSeed: string;
  donorName: string;
  donorPhone: string | null;
  donorDOB: string | null;
  donorSex: string | null;
  createdAt: string;
  accountStatus: DonorAccountStatus | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  user: { userEmail: string };
  emailVerified: boolean;
  lastLoginAt: string | null;
}

export const getMyDonorProfile = async (): Promise<DonorSelfProfile> => {
  const response = await axiosInstance.get("/donors/me");
  return response.data.data;
};

// Partial update — avatarSeed, donorName, donorPhone, donorDOB, donorSex and
// the address fields. accountStatus/stripeCustomerID are rejected (400).
export const updateMyDonorProfile = async (
  payload: Record<string, unknown>,
): Promise<DonorSelfProfile> => {
  const response = await axiosInstance.put("/donors/me", payload);
  return response.data.data;
};

// ———————————————— CLOSE ACCOUNT ————————————————
// 'deactivate' keeps the row; 'delete' removes it for good. Either way the
// donations stay on the shelters' books (a deleted donor's show as "Former
// donor" to staff). Nothing blocks a donor from closing — no 409.
export type DonorCloseAccountMode = "deactivate" | "delete";

export const closeMyDonorAccount = async (mode: DonorCloseAccountMode): Promise<void> => {
  await axiosInstance.delete("/donors/me", { data: { mode } });
};

// ———————————————— ONBOARDING API ————————————————
// Step 2 Personal, 3 Address, 4 Review (no Identity step). `step` is the
// step just completed; onboardingStep only ever advances. Skippable —
// donating never waits on it.
export const advanceMyDonorOnboardingStep = async (
  step: number,
): Promise<DonorSelfProfile> => {
  const response = await axiosInstance.patch("/donors/me/onboarding-step", { step });
  return response.data.data;
};

// Review step's Submit. 409 (naming what's missing) unless phone, DOB, sex
// and the address are all present.
export const completeMyDonorOnboarding = async (): Promise<DonorSelfProfile> => {
  const response = await axiosInstance.patch("/donors/me/onboarding-complete");
  return response.data.data;
};

// ———————————————— DONATIONS ————————————————
// Whole US dollars — the server's limits (config/fees.js).
export const DONATION_MIN_USD = 1;
export const DONATION_MAX_USD = 10000;

export interface DonorDonation {
  donationID: number;
  donationCode: string | null;
  donationDate: string;
  donationAmt: number;
  donationDesc: string | null;
  shelter: { shelterID: number; shelterName: string };
}

export interface DonationCheckoutPayload {
  shelterID: number;
  amount: number; // whole dollars
  donationDesc?: string;
}

// Returns Stripe's hosted Checkout URL. No donation exists yet — the
// webhook records it after payment (see DonateConfirmation). A Closed
// shelter is 409.
export const createDonationCheckout = async (
  payload: DonationCheckoutPayload,
): Promise<{ checkoutUrl: string }> => {
  const response = await axiosInstance.post("/donations/checkout", payload);
  return response.data.data;
};

interface MyDonationsParams {
  shelterID?: number;
  dateFrom?: string; // inclusive
  dateTo?: string; // exclusive
  page?: number;
  limit?: number;
}

// Newest first.
export const getMyDonations = async (
  params?: MyDonationsParams,
): Promise<{ data: DonorDonation[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/donors/me/donations", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// The confirmation page's poll — null until the Stripe webhook has
// recorded the donation for this Checkout session.
export const getDonationByCheckoutSession = async (
  checkoutSessionId: string,
): Promise<DonorDonation | null> => {
  const response = await axiosInstance.get("/donors/me/donations", {
    params: { checkoutSessionId },
  });
  return response.data.data;
};

export interface DonorDonationStats {
  totalAmount: number;
  donationCount: number;
  thisYearAmount: number;
  byShelter: {
    shelterID: number;
    shelterName: string;
    totalAmount: number;
    donationCount: number;
  }[];
}

// Over every donation the donor has made. yearStart is the donor's local
// start of the year, so "this year" follows their timezone.
export const getMyDonationStats = async (
  yearStart: string,
): Promise<DonorDonationStats> => {
  const response = await axiosInstance.get("/donors/me/donations/stats", {
    params: { yearStart },
  });
  return response.data.data;
};
