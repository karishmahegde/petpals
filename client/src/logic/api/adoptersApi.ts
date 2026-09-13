// What it does: API functions for the authenticated adopter's own resources
// (profile, applications, visits, favorites, …). stripeCustomerID and other
// sensitive fields are never returned by the backend.
import axiosInstance from "./axiosInstance";
import type { Pagination, PetCard, PetDetail } from "./petsApi";

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
  emailVerified: boolean;
  lastLoginAt: string | null;
  accountStatus: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  onboardingComplete: boolean;
  onboardingStep: number;
}

// ———————————————— ADOPTER PROFILE API ————————————————
export const getAdopterProfile = async (): Promise<AdopterProfile> => {
  const response = await axiosInstance.get("/adopters/me");
  return response.data.data;
};

// Partial update — the backend accepts any subset of the editable fields and
// validates enums / lengths server-side. adopterEmail, adopterPassword,
// adopterRiskFlag, preQualifyFlag, accountStatus, onboardingComplete and
// onboardingStep are rejected with 400 — the last two are only advanced via
// advanceOnboardingStep()/completeOnboarding() below.
export const updateAdopterProfile = async (
  payload: Record<string, unknown>,
): Promise<AdopterProfile> => {
  const response = await axiosInstance.put("/adopters/me", payload);
  return response.data.data;
};

// Called after a wizard step's own data has been saved — `step` is the step
// # just completed (2-6). Server-side, onboardingStep only ever advances.
export const advanceOnboardingStep = async (
  step: number,
): Promise<AdopterProfile> => {
  const response = await axiosInstance.patch("/adopters/me/onboarding-step", {
    step,
  });
  return response.data.data;
};

// Called on final submit of the onboarding wizard's Review step.
export const completeOnboarding = async (): Promise<AdopterProfile> => {
  const response = await axiosInstance.patch(
    "/adopters/me/onboarding-complete",
  );
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
export type ApplicationStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Withdrawn";

export interface AdoptionApplicationListItem {
  applicationID: number;
  petID: number;
  shelterID: number;
  applicationStatus: ApplicationStatus;
  createdAt: string;
  pet: {
    petName: string;
    petPhoto: string | null;
    breed: { breedName: string };
  };
  shelter: { shelterName: string };
}

export interface PaginatedApplications {
  data: AdoptionApplicationListItem[];
  pagination: Pagination;
}

interface ApplicationListParams {
  petID?: number;
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export const getMyApplications = async (
  params?: ApplicationListParams,
): Promise<AdoptionApplicationListItem[]> => {
  const response = await axiosInstance.get("/adopters/me/applications", {
    params,
  });
  return response.data.data;
};

// Same endpoint as getMyApplications, but keeps the pagination envelope — used
// by the full Applications section, which drives Prev/Next off it.
export const getMyApplicationsPage = async (
  params?: ApplicationListParams,
): Promise<PaginatedApplications> => {
  const response = await axiosInstance.get("/adopters/me/applications", {
    params,
  });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Lightweight count-only read — same endpoint as getMyApplications, but with
// limit=1 to fetch as little as possible, reading pagination.total for the
// real total instead of relying on how many rows came back on one page.
export const getMyApplicationsCount = async (): Promise<number> => {
  const response = await axiosInstance.get("/adopters/me/applications", {
    params: { limit: 1 },
  });
  return response.data.pagination.total;
};

// ———————————————— ADOPTED PETS API ————————————————
// Same PetCard shape as GET /pets / GET /pets/featured — lets the client
// reuse PetCatalogCard as-is for the adopter's own pets.
export const getMyAdoptedPets = async (): Promise<PetCard[]> => {
  const response = await axiosInstance.get("/adopters/me/adopted-pets");
  return response.data.data;
};

// One consolidated payload for the My Pets side panel (PetDetailPanel) —
// GET /adopters/me/adopted-pets/:petId. Requires an Accepted application for
// the pet (403 otherwise).
export interface AdoptedPetVaccination {
  recordID: number;
  vaccineName: string;
  administeredDate: string;
  dueDate: string;
  vetName: string | null;
}

export interface AdoptedPetAppointment {
  appointmentID: number;
  appointmentDate: string;
  appointmentReason: string;
  vetName: string | null;
  shelterName: string | null;
}

export interface AdoptedPetDetail {
  petID: number;
  petCode: string; // e.g. "PE003794"
  petName: string;
  petPhoto: string | null;
  microchipID: string | null;
  petAge: string; // long form, e.g. "5 months"
  petDOB: string;
  petSex: string;
  petColor: string;
  petSize: string | null;
  petHeight: number; // cm
  petWeight: number; // kg
  petBGroup: string;
  petDesc: string | null;
  adoptionStatus: string;
  breed: { breedName: string; speciesName: string };
  compatibility: {
    children: boolean;
    otherPets: boolean;
    specialNeeds: boolean;
  };
  health: {
    vaccinations: AdoptedPetVaccination[];
    // Upcoming only, soonest first — full history is on the Appointments section.
    appointments: AdoptedPetAppointment[];
  };
  adoption: {
    adoptedOn: string; // Accepted application's createdAt
    shelterName: string;
    shelterAddress: string;
    yourMessage: string | null;
    staffRemark: string | null;
  };
}

export const getAdoptedPetDetail = async (
  petID: number,
): Promise<AdoptedPetDetail> => {
  const response = await axiosInstance.get(
    `/adopters/me/adopted-pets/${petID}`,
  );
  return response.data.data;
};

// ———————————————— FAVORITES API ————————————————
// Each entry is the full pet-detail shape (same as GET /pets/:id) — see
// petsApi.ts's PetDetail.
export const getMyFavorites = async (): Promise<PetDetail[]> => {
  const response = await axiosInstance.get("/adopters/me/favorites");
  return response.data.data;
};

// ———————————————— VISITS API ————————————————
export type VisitStatus = "Confirmed" | "Cancelled" | "Completed";

export interface VisitListItem {
  visitID: number;
  adopterID: number;
  petID: number | null;
  staffID: number | null;
  shelterID: number;
  visitTime: string;
  remarks: string | null;
  // null until a staff member confirms it.
  visitStatus: VisitStatus | null;
  shelter: { shelterName: string };
  pet: { petName: string } | null;
}

// Ordered by visitTime ascending. `upcoming` narrows to future visits only.
export const getMyVisits = async (params?: {
  upcoming?: boolean;
}): Promise<VisitListItem[]> => {
  const response = await axiosInstance.get("/adopters/me/visits", {
    params: params?.upcoming ? { upcoming: "true" } : undefined,
  });
  return response.data.data;
};

// ———————————————— APPOINTMENTS API ————————————————
// Vet appointments for the adopter's own pets (pets they have an Accepted
// application for). Set by the shelter/vet — the adopter can't create these.
export interface AppointmentListItem {
  appointmentID: number;
  appointmentDate: string;
  appointmentReason: string;
  pet: { petID: number; petName: string };
  shelter: { shelterName: string };
  vet: { vetName: string };
}

// Ordered by appointmentDate ascending. `upcoming` narrows to future ones.
export const getMyAppointments = async (params?: {
  upcoming?: boolean;
}): Promise<AppointmentListItem[]> => {
  const response = await axiosInstance.get("/adopters/me/appointments", {
    params: params?.upcoming ? { upcoming: "true" } : undefined,
  });
  return response.data.data;
};

// Full record behind one Appointments row — for the detail slide-over
// (GET /adopters/me/appointments/:id). Requires an Accepted application for
// the appointment's pet (404 otherwise).
export interface AppointmentDetail {
  appointmentID: number;
  appointmentCode: string; // e.g. "APT-00123"
  appointmentDate: string;
  appointmentReason: string;
  pet: {
    petID: number;
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  };
  vetName: string | null;
  shelterName: string;
  shelterAddress: string;
  // Vaccination records for the pet dated the same day as the appointment.
  vaccinesAdministered: {
    recordID: number;
    vaccineName: string;
    dueDate: string;
  }[];
}

export const getAppointmentDetail = async (
  appointmentID: number,
): Promise<AppointmentDetail> => {
  const response = await axiosInstance.get(
    `/adopters/me/appointments/${appointmentID}`,
  );
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
