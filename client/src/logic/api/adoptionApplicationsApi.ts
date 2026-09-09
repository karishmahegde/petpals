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
  paymentStatus: "Paid";
  amountPaid: number;
  createdAt: string;
  pet?: { petName: string };
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
