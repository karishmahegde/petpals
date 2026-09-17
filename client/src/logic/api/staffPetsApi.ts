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
};

export const updatePet = async (
  petID: number,
  payload: UpdatePetPayload,
): Promise<StaffPetDetail> => {
  const response = await axiosInstance.put(`/pets/${petID}`, payload);
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
  /** Make this the pet's primary photo. The very first photo ever uploaded
   * becomes primary automatically regardless of this flag. */
  primary?: boolean;
}

// multipart/form-data — JPEG/PNG/WebP only, narrower than the government-ID
// upload's allowed set.
export const uploadPetPhoto = async (
  petID: number,
  { file, primary }: UploadPetPhotoPayload,
): Promise<PetPhoto[]> => {
  const formData = new FormData();
  formData.append("file", file);
  if (primary) formData.append("primary", "true");
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
