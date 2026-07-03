// What it does: API functions for auth endpoints (refresh token, login, logout)
import axiosInstance from "./axiosInstance";

export interface AuthUser {
  userID: number;
  userEmail?: string; // present on login, absent on refresh-token response
  role: string;
  name?: string; // present on login, absent on refresh-token response
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
}

// ———————————————— REGISTER API ————————————————
export const register = async (payload: RegisterPayload): Promise<void> => {
  await axiosInstance.post("/auth/register", payload);
};
