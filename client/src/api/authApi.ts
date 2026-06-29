// What it does: API functions for auth endpoints (refresh token, login, logout)
import axiosInstance from "./axiosInstance";

export interface AuthUser {
  // return object shape
  id: number;
  email: string;
  role: string;
  name?: string;
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
