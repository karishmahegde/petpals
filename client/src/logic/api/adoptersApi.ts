// What it does: API functions for the authenticated adopter's own resources
// (profile, applications, visits, favorites, …). stripeCustomerID and other
// sensitive fields are never returned by the backend.
import axiosInstance from "./axiosInstance";

export interface AdopterProfile {
  userID: number;
  adopterName: string;
  shelterID: number | null;
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
