// selfGovernmentIdApi.ts
// Every worker role's own GET/POST /<role>/me/government-id behaves the same
// (one shared server service — services/governmentIds/selfGovernmentId
// .service.js), so the client calls are built once here per role and handed
// to the shared GovernmentIdSection (pages/protected/shared/) as an object.
import axiosInstance from "./axiosInstance";

export interface GovernmentIdRecord {
  governmentIDID: number;
  userID: number;
  userType: string;
  idType: string;
  idNumber: string; // masked — only the last 4 characters, e.g. "*****6789"
  verificationStatus: "Pending" | "Verified" | "Rejected";
  documentURL: string | null;
}

export interface UploadGovernmentIdPayload {
  idType: string;
  idNumber: string;
  file: File;
}

export interface SelfGovernmentIdApi {
  queryKey: readonly unknown[];
  // 404 means no ID has been submitted yet — callers treat that as a normal
  // "not submitted" state, not an error to surface.
  get: () => Promise<GovernmentIdRecord>;
  // multipart/form-data — one ID per user; a second submission is a 409
  // unless the existing one was Rejected (then it's overwritten, back to
  // Pending).
  upload: (payload: UploadGovernmentIdPayload) => Promise<GovernmentIdRecord>;
}

export const makeSelfGovernmentIdApi = (
  path: string,
  queryKey: readonly unknown[],
): SelfGovernmentIdApi => ({
  queryKey,
  get: async () => {
    const response = await axiosInstance.get(path);
    return response.data.data;
  },
  upload: async ({ idType, idNumber, file }) => {
    const formData = new FormData();
    formData.append("idType", idType);
    formData.append("idNumber", idNumber);
    formData.append("file", file);
    const response = await axiosInstance.post(path, formData);
    return response.data.data;
  },
});
