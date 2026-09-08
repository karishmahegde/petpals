// What it does: API functions for the authenticated adopter's own resources
// (profile, applications, visits, favorites, …). stripeCustomerID and other
// sensitive fields are never returned by the backend.
import axiosInstance from "./axiosInstance";

export interface AdopterProfile {
  userID: number;
  avatarSeed: string;
  adopterName: string;
  adopterDOB: string | null;
  adopterSex: string | null;
  createdAt: string;
  adopterRiskFlag: boolean;
  preQualifyFlag: boolean;
  adopterPhone: string | null;
  housingType: string | null;
  ownsOrRents: string | null;
  landlordContact: string | null;
  householdSize: number | null;
  numChildren: number | null;
  employmentStatus: string | null;
  activityLevel: string | null;
  yardAvailable: boolean;
  petExperience: string | null;
  currentPets: number;
  preferredBreedID: number | null;
  preferredAgeRange: string | null;
  preferredSize: string | null;
  openToSpecialNeeds: boolean;
  adopterType: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  accountStatus: string;
}

// ———————————————— ADOPTER PROFILE API ————————————————
export const getAdopterProfile = async (): Promise<AdopterProfile> => {
  const response = await axiosInstance.get("/adopters/me");
  return response.data.data;
};

// Partial update — the backend accepts any subset of the editable fields and
// validates enums / lengths server-side. adopterEmail, adopterPassword,
// adopterRiskFlag, preQualifyFlag and accountStatus are rejected with 400.
export const updateAdopterProfile = async (
  payload: Record<string, unknown>,
): Promise<AdopterProfile> => {
  const response = await axiosInstance.put("/adopters/me", payload);
  return response.data.data;
};

// ———————————————— GOVERNMENT ID API ————————————————
export interface GovernmentIdRecord {
  governmentIDID: number;
  userID: number;
  userType: string;
  idType: string;
  idNumber: string; // masked — only the last 4 characters, e.g. "*****6789"
  verificationStatus: "Pending" | "Verified" | "Rejected";
  documentURL: string | null;
}

// 404 means no ID has been submitted yet — callers should treat that as a
// normal "not submitted" state, not an error to surface.
export const getGovernmentId = async (): Promise<GovernmentIdRecord> => {
  const response = await axiosInstance.get("/adopters/me/government-id");
  return response.data.data;
};

export interface UploadGovernmentIdPayload {
  idType: string;
  idNumber: string;
  file: File;
}

// multipart/form-data — one government ID per adopter; a second submission
// is rejected server-side with 409.
export const uploadGovernmentId = async (
  payload: UploadGovernmentIdPayload,
): Promise<GovernmentIdRecord> => {
  const formData = new FormData();
  formData.append("idType", payload.idType);
  formData.append("idNumber", payload.idNumber);
  formData.append("file", payload.file);
  const response = await axiosInstance.post(
    "/adopters/me/government-id",
    formData,
  );
  return response.data.data;
};

// ———————————————— APPLICATIONS API ————————————————
export interface AdoptionApplicationListItem {
  applicationID: number;
  petID: number;
  shelterID: number;
  applicationStatus: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  createdAt: string;
  pet: { petName: string; petPhoto: string | null };
  shelter: { shelterName: string };
}

export const getMyApplications = async (params?: {
  petID?: number;
  status?: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
}): Promise<AdoptionApplicationListItem[]> => {
  const response = await axiosInstance.get("/adopters/me/applications", {
    params,
  });
  return response.data.data;
};

// ———————————————— CLOSE ACCOUNT API ————————————————
// 'deactivate' keeps data (no self-service reactivation yet); 'delete' is
// permanent. Both are blocked server-side (409) if an Accepted adoption
// application exists for this adopter.
export type CloseAccountMode = "deactivate" | "delete";

export const closeAccount = async (mode: CloseAccountMode): Promise<void> => {
  await axiosInstance.delete("/adopters/me", { data: { mode } });
};
