// What it does: Staff pet-management API — the shelter-scoped pet roster
// (GET /staff/me/pets, which unlike public petsApi.ts's getPets isn't
// limited to adoptionStatus=available) plus create/update/delete and photo
// management. Separate file from petsApi.ts (public catalog, read-only) and
// staffApi.ts (staff account domain) — this is its own feature/domain, same
// convention as adoptionApplicationsApi.ts living apart from adoptersApi.ts.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type PetAdoptionStatus =
  | "incoming"
  | "available"
  | "pending"
  | "adopted"
  | "fostered"
  | "transferred"
  | "deceased";

export const PET_ADOPTION_STATUS_VALUES: PetAdoptionStatus[] = [
  "incoming",
  "available",
  "pending",
  "adopted",
  "fostered",
  "transferred",
  "deceased",
];

export type IntakeType = "stray" | "surrendered" | "transferred";

export const PET_INTAKE_TYPE_VALUES: IntakeType[] = [
  "stray",
  "surrendered",
  "transferred",
];

// Same shape as public petsApi.ts's PetCard, plus adoptionStatus (which the
// public shape omits — the catalog only ever shows available pets, so it
// has no reason to return the field).
export interface StaffPetListItem {
  petID: number;
  petName: string;
  petAge: string;
  petSex: string;
  petPhoto: string | null;
  adoptionStatus: PetAdoptionStatus;
  intakeDate: string;
  breed: {
    breedName: string;
    speciesName: string;
  };
}

export interface PaginatedStaffPets {
  data: StaffPetListItem[];
  pagination: Pagination;
}

interface StaffPetListParams {
  adoptionStatus?: PetAdoptionStatus;
  // Same query param names/repeatable-array convention as public
  // petsApi.ts's getPets, so the Staff Pets tab can reuse the exact same
  // catalog filter bar (minus the location/shelter filter — there's only
  // ever one shelter here).
  species?: number[];
  breed?: string[];
  size?: string[];
  minAge?: string;
  maxAge?: string;
  // Omit for the existing petID-descending default. 'newest' orders by
  // intakeDate descending — used by the Staff Overview New Arrivers widget
  // (adoptionStatus: "incoming", sort: "newest").
  sort?: "newest";
  page?: number;
  limit?: number;
}

export const getMyShelterPets = async (
  params?: StaffPetListParams,
): Promise<PaginatedStaffPets> => {
  const response = await axiosInstance.get("/staff/me/pets", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// Same detail shape public GET /pets/:id returns — createPet/updatePet
// reuse that endpoint's getPetDetails formatter server-side.
export interface StaffPetDetail {
  petID: number;
  petName: string;
  petAge: string;
  petSex: string;
  petColor: string;
  petHeight: number;
  petWeight: number;
  petDesc: string | null;
  petPhoto: string | null;
  adoptionStatus: PetAdoptionStatus;
  breed: {
    breedID: number;
    breedName: string;
    speciesName: string;
  };
  shelter: {
    shelterID: number;
    shelterName: string;
    shelterAddress: string;
  };
  compatibleWithChildren: boolean;
  compatibleWithPets: boolean;
  specialNeeds: boolean;
}

const PET_SEX_VALUES = ["M", "F"] as const;
export type PetSex = (typeof PET_SEX_VALUES)[number];
const PET_SIZE_VALUES = ["Small", "Medium", "Large"] as const;
export type PetSize = (typeof PET_SIZE_VALUES)[number];

// Richer than StaffPetDetail — adds the fields public GET /pets/:id (which
// createPet/updatePet's response reuses) doesn't return: petCode,
// microchipID, petSize, petBGroup, and the raw petDOB (StaffPetDetail has no
// DOB at all, only the formatted petAge). Powers the Pets tab's read-only
// detail view and pre-fills the edit form with real values instead of
// leaving them blank for staff to re-enter.
export interface StaffPetFullDetail extends StaffPetDetail {
  petCode: string;
  petDOB: string; // ISO date-time
  petSize: PetSize | null;
  petBGroup: string;
  microchipID: string | null;
  intakeDate: string; // ISO date-time
  intakeType: IntakeType | null;
  featuredFlag: boolean;
}

export const getShelterPetDetail = async (
  petID: number,
): Promise<StaffPetFullDetail> => {
  const response = await axiosInstance.get(`/staff/me/pets/${petID}`);
  return response.data.data;
};

// ——————————————— HEALTH PASSPORT (GET /staff/me/pets/:id/health-passport) ———————————————
export interface HealthRecordItem {
  recordID: number;
  createdAt: string;
  recordDesc: string;
  vetName: string | null;
  shelterName: string | null;
}

export type VaccinationStatus = "Overdue" | "Due Soon" | "Up to Date";

export interface VaccinationItem {
  recordID: number;
  vaccineName: string;
  administeredDate: string;
  dueDate: string;
  status: VaccinationStatus;
}

export interface PetTransferHistoryItem {
  recordID: number;
  transferDate: string;
  transferReason: string;
  transferStatus: "In_Progress" | "Completed" | "Rejected" | "Cancelled";
  fromShelterName: string;
  toShelterName: string;
  fromStaffName: string | null;
  toStaffName: string | null;
}

// transferHistory here is the pet's full cross-shelter history, NOT scoped
// to the caller's own shelter — see transfersApi.ts's getTransfersQueue for
// the (shelter-scoped) Transfers tab's own version of transfer history.
export interface HealthPassportData {
  pet: StaffPetFullDetail;
  healthRecords: HealthRecordItem[];
  vaccinations: VaccinationItem[];
  transferHistory: PetTransferHistoryItem[];
}

export const getHealthPassport = async (
  petID: number,
): Promise<HealthPassportData> => {
  const response = await axiosInstance.get(`/staff/me/pets/${petID}/health-passport`);
  return response.data.data;
};

// Required fields on create — see server/src/controllers/staff/pets.controller.js's
// CREATE_REQUIRED_FIELDS for why petName/petWeight/petHeight are required
// here despite the ticket framing them as PUT-only (all three are NOT NULL
// in the schema with no default). petBGroup is optional — defaults to
// "N/A" server-side when omitted.
export interface CreatePetPayload {
  breedID: number;
  petName: string;
  petDOB: string; // "YYYY-MM-DD"
  petSex: PetSex;
  petColor: string;
  petSize: PetSize;
  intakeDate: string; // "YYYY-MM-DD"
  intakeType?: IntakeType | null;
  petWeight: number;
  petHeight: number;
  petBGroup?: string;
}

export const createPet = async (
  payload: CreatePetPayload,
): Promise<StaffPetDetail> => {
  const response = await axiosInstance.post("/pets", payload);
  return response.data.data;
};

// Partial update — everything creatable, minus shelterID (reassignment is a
// transfer, out of scope here), plus petDesc/microchipID/featuredFlag/
// adoptionStatus. adoptionStatus is edit-only (create always starts a pet
// at "available") — lets staff manually correct/override it (e.g. mark
// deceased or transferred) alongside the Pending/Accepted transitions the
// adoption application workflow already drives automatically.
export type UpdatePetPayload = Partial<CreatePetPayload> & {
  petDesc?: string | null;
  microchipID?: string | null;
  featuredFlag?: boolean;
  adoptionStatus?: PetAdoptionStatus;
  compatibleWithChildren?: boolean;
  compatibleWithPets?: boolean;
  specialNeeds?: boolean;
};

// Multipart, not JSON — an optional photo can now be saved together with
// the field changes in ONE request (the edit form's Save button), rather
// than a separate immediate upload. Server-side this REPLACES the pet's
// existing photo (v1 is one photo per pet, not a gallery); omit `photoFile`
// to leave it untouched. `null`/`undefined` payload values are dropped
// (multipart can't represent a real null) — the one field that's actually
// clearable this way, petDesc, has the server treat an explicit empty
// string as "clear it", so send "" rather than omitting the key for that.
export const updatePet = async (
  petID: number,
  payload: UpdatePetPayload,
  photoFile?: File | null,
): Promise<StaffPetDetail> => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    formData.append(key, value === null ? "" : String(value));
  }
  if (photoFile) formData.append("file", photoFile);

  const response = await axiosInstance.put(`/pets/${petID}`, formData);
  return response.data.data;
};

// 409 CONFLICT if the pet has a Pending/Accepted adoption application —
// surfaced via the caller's own error handling, same as everywhere else.
export const deletePet = async (petID: number): Promise<void> => {
  await axiosInstance.delete(`/pets/${petID}`);
};

export interface PetPhoto {
  photoID: number;
  photoURL: string;
  uploadedAt: string;
  isPrimary: boolean;
}

export const getPetPhotos = async (petID: number): Promise<PetPhoto[]> => {
  const response = await axiosInstance.get(`/pets/${petID}/photos`);
  return response.data.data;
};

export interface UploadPetPhotoPayload {
  file: File;
}

// multipart/form-data — JPEG/PNG/WebP only, narrower than the government-ID
// upload's allowed set. v1 supports exactly one photo per pet, not a
// gallery — this REPLACES whatever photo the pet had before, server-side.
export const uploadPetPhoto = async (
  petID: number,
  { file }: UploadPetPhotoPayload,
): Promise<PetPhoto[]> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.post(
    `/pets/${petID}/photos`,
    formData,
  );
  return response.data.data;
};

export const deletePetPhoto = async (
  petID: number,
  photoID: number,
): Promise<PetPhoto[]> => {
  const response = await axiosInstance.delete(
    `/pets/${petID}/photos/${photoID}`,
  );
  return response.data.data;
};
