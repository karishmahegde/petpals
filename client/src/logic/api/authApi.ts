// What it does: API functions for auth endpoints (session, registration, and
// the emailed-link flows: email verification, password reset/change,
// reactivation, email change)
import axios from "axios";
import axiosInstance from "./axiosInstance";

export interface AuthUser {
  userID: number;
  userEmail?: string; // present on login, absent on refresh-token response
  role: string;
  name?: string; // present on login, absent on refresh-token response
  avatarSeed?: string; // present on both login and refresh-token responses
  // Present on both login and refresh-token responses for roles with an
  // onboarding wizard (every role but Admin); absent for Admin.
  onboardingComplete?: boolean;
  onboardingStep?: number;
  // Staff, Veterinarian and Volunteer only. A Pending one can log in — to
  // onboard before they're approved — so OnboardingGate needs to know
  // they're still Pending once onboarding is done.
  accountStatus?: string;
  // Every role, on both login and refresh-token responses. Only applying to
  // adopt and donating need it true (the soft gate); everything else works
  // unverified, behind a banner.
  emailVerified?: boolean;
}

export interface RefreshTokenResponse {
  // server response object shape
  token: string;
  user: AuthUser;
}

export const refreshToken = async (): Promise<RefreshTokenResponse> => {
  // return is of type promise (because we use async, and once the promise resolves, the type of object we get is RefreshTokenRespose)
  const response = await axiosInstance.post("/auth/refresh-token", {});
  return response.data.data;
};

export interface LoginPayload {
  email: string;
  password: string;
}

// ———————————————— LOGIN API ————————————————
export const login = async (
  payload: LoginPayload,
): Promise<RefreshTokenResponse> => {
  const response = await axiosInstance.post("/auth/login", payload);
  return response.data.data;
};

// ———————————————— LOGOUT API ————————————————
export const logout = async (): Promise<void> => {
  await axiosInstance.post("/auth/logout");
};

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  shelterID?: number; // volunteer/staff/vet — the shelter that approves them
}

// ———————————————— REGISTER API ————————————————
export const register = async (payload: RegisterPayload): Promise<void> => {
  await axiosInstance.post("/auth/register", payload);
};

// ———————————————— EMAILED-LINK FLOWS ————————————————
// Every link carries a single-use token; the PATCH that redeems it needs no
// session (the link may be opened on another device). A bad link is a 400
// with error.details.reason — see linkErrorReason below.

// Signed in: email a new verification link (409 if already verified, 429
// within a minute of the last one).
export const requestEmailVerification = async (): Promise<void> => {
  await axiosInstance.post("/auth/email-verification");
};

export const verifyEmail = async (
  token: string,
): Promise<{ emailVerified: true }> => {
  const response = await axiosInstance.patch("/auth/email-verification", {
    token,
  });
  return response.data.data;
};

// Always 200 — the server never says whether the email has an account.
export const requestPasswordReset = async (email: string): Promise<void> => {
  await axiosInstance.post("/auth/password-reset", { email });
};

// Signs out every session. Returns the account's role so the page can send
// them to the right login.
export const resetPassword = async (
  token: string,
  password: string,
): Promise<{ role: string | null }> => {
  const response = await axiosInstance.patch("/auth/password-reset", {
    token,
    password,
  });
  return response.data.data;
};

// Signed in. 401 with reason "wrong_password" if currentPassword is wrong.
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  await axiosInstance.patch("/auth/password", { currentPassword, newPassword });
};

// Always 200; a link is only sent to an account its owner closed.
export const requestReactivation = async (email: string): Promise<void> => {
  await axiosInstance.post("/auth/reactivation", { email });
};

// Adopter/Donor come back Active; worker roles come back Pending.
export const reactivateAccount = async (
  token: string,
): Promise<{ role: string; accountStatus: string }> => {
  const response = await axiosInstance.patch("/auth/reactivation", { token });
  return response.data.data;
};

// Signed in. Sends a confirmation link to newEmail; nothing changes until
// it's opened.
export const requestEmailChange = async (
  newEmail: string,
  currentPassword: string,
): Promise<void> => {
  await axiosInstance.post("/auth/email-change", { newEmail, currentPassword });
};

export const confirmEmailChange = async (
  token: string,
): Promise<{ userEmail: string }> => {
  const response = await axiosInstance.patch("/auth/email-change", { token });
  return response.data.data;
};

// The machine-readable reason on an error response
// (error.details.reason), e.g. "token_expired", "email_unverified".
export const errorReason = (err: unknown): string | undefined => {
  if (!axios.isAxiosError(err)) return undefined;
  const reason = err.response?.data?.error?.details?.reason;
  return typeof reason === "string" ? reason : undefined;
};

// The soft gate: applying to adopt and donating answer 409 with this reason
// while the email isn't verified.
export const isEmailUnverifiedError = (err: unknown): boolean =>
  errorReason(err) === "email_unverified";
