// What it does: API functions for the public pet catalog endpoints (species, breeds, shelters, pets)
import axiosInstance from "./axiosInstance";

// ———————————————— RESPONSE DATA OBJECT SHAPE DEFINITIONS ————————————————
export interface Species {
  speciesID: number;
  speciesName: string;
}

export interface Breed {
  breedID: number;
  breedName: string;
  speciesName: string;
}

export interface Shelter {
  shelterID: number;
  shelterName: string;
}

export interface NearbyShelter extends Shelter {
  shelterAddress: string;
  shelterZIP: string;
  distance: number;
}

export interface PetCard {
  petID: number;
  petName: string;
  petAge: string;
  petSex: string;
  petPhoto: string | null;
  breed: {
    breedName: string;
    speciesName: string;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PetFilters {
  speciesID?: number[];
  breedName?: string[];
  size?: string[];
  minAge?: string;
  maxAge?: string;
  shelterID?: number[];
}

export interface PaginatedPets {
  data: PetCard[];
  pagination: Pagination;
}

export interface PetDetail {
  petID: number;
  petName: string;
  petAge: string;
  petSex: string;
  petColor: string;
  petHeight: number;
  petWeight: number;
  petDesc: string | null;
  // Not yet returned by GET /pets/:id on the backend — falls back to a
  // placeholder in the UI until the service selects/returns this field.
  petPhoto: string | null;
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

// ———————————————— SPECIES API ————————————————
export const getSpecies = async (): Promise<Species[]> => {
  const response = await axiosInstance.get("/species");
  return response.data.data;
};

// ———————————————— BREEDS API ————————————————
export const getBreeds = async (speciesIDs: number[]): Promise<Breed[]> => {
  const response = await axiosInstance.get("/breeds", {
    params: { speciesID: speciesIDs },
  });
  return response.data.data;
};

// ———————————————— SHELTERS API ————————————————
export const getShelters = async (): Promise<Shelter[]> => {
  const response = await axiosInstance.get("/shelters");
  return response.data.data;
};

export interface NearbySearchLocation {
  lat?: number;
  lng?: number;
  postalCode?: string;
  radius: number;
}

export const getNearbyShelters = async ({
  lat,
  lng,
  postalCode,
  radius,
}: NearbySearchLocation): Promise<NearbyShelter[]> => {
  const params =
    postalCode !== undefined ? { postalCode, radius } : { lat, lng, radius };
  const response = await axiosInstance.get("/shelters/nearby", { params });
  return response.data.data;
};

// ———————————————— PETS API ————————————————
export const getPets = async (
  filters: PetFilters,
  page: number,
  limit: number,
): Promise<PaginatedPets> => {
  const params: Record<string, string | number | string[] | number[]> = {
    page,
    limit,
  };
  // checking is filter value is available, or array length is > 0 and assigning it to the key for the request
  if (filters.speciesID?.length) params.species = filters.speciesID;
  if (filters.breedName?.length) params.breed = filters.breedName;
  if (filters.size?.length) params.size = filters.size;
  if (filters.minAge) params.minAge = filters.minAge;
  if (filters.maxAge) params.maxAge = filters.maxAge;
  if (filters.shelterID?.length) params.shelterID = filters.shelterID;

  const response = await axiosInstance.get("/pets", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

// ———————————————— PET DETAILS API ————————————————
export const getPetById = async (petID: number): Promise<PetDetail> => {
  const response = await axiosInstance.get(`/pets/${petID}`);
  return response.data.data;
};

// ———————————————— FEATURED PETS API ————————————————
export const getFeaturedPets = async (): Promise<PetCard[]> => {
  const response = await axiosInstance.get("/pets/featured");
  return response.data.data;
};
