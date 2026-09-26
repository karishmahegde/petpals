// staffAdoptersApi.ts
// Read-only adopter directory for the Staff dashboard's People → Adopters
// tab — GET /adopters (list) and GET /adopters/:id (full profile). Adopters
// aren't tied to one shelter, so this is every adopter account network-wide.
// Status changes (ban/deactivate) are Admin-only and not exposed here.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type AdopterAccountStatus = "Active" | "Banned" | "Deactivated";

export interface AdopterListItem {
  userID: number;
  avatarSeed: string;
  adopterName: string;
  adopterPhone: string | null;
  accountStatus: AdopterAccountStatus;
  adopterRiskFlag: boolean;
  preQualifyFlag: boolean;
  createdAt: string;
  city: string;
  state: string;
  country: string;
  user: { userEmail: string };
}

// Full profile — never governmentID or stripeCustomerID; the ID is reduced
// to its verification status.
export interface AdopterDetail extends Omit<AdopterListItem, "user"> {
  adopterEmail: string;
  adopterDOB: string | null;
  adopterSex: "M" | "F" | null;
  addressLine1: string;
  addressLine2: string | null;
  zip: string;
  housingType: "Apartment" | "House" | "Other" | null;
  ownsOrRents: "Owns" | "Rents" | null;
  landlordContact: string | null;
  householdSize: number | null;
  numChildren: number | null;
  employmentStatus: string | null;
  activityLevel: string | null;
  yardAvailable: boolean;
  petExperience: string | null;
  currentPets: number;
  preferredBreedName: string | null;
  preferredAgeRange: string | null;
  preferredSize: string | null;
  openToSpecialNeeds: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  onboardingComplete: boolean;
  governmentIdStatus: "Pending" | "Verified" | "Rejected" | null;
}

interface AdoptersParams {
  accountStatus?: AdopterAccountStatus;
  name?: string;
  page?: number;
  limit?: number;
}

export const getAdopters = async (
  params: AdoptersParams,
): Promise<{ data: AdopterListItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/adopters", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getAdopterDetail = async (
  userID: number,
): Promise<AdopterDetail> => {
  const response = await axiosInstance.get(`/adopters/${userID}`);
  return response.data.data;
};
