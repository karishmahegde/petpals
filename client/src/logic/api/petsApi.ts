// What it does: API functions for the public pet catalog endpoints (species, breeds, shelters, pets)
import axiosInstance from "./axiosInstance";

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
  speciesName?: string;
  breedName?: string;
  size?: string;
  minAge?: string;
  maxAge?: string;
  shelterID?: number | null;
}

export interface PaginatedPets {
  data: PetCard[];
  pagination: Pagination;
}

// ———————————————— SPECIES API ————————————————
export const getSpecies = async (): Promise<Species[]> => {
  const response = await axiosInstance.get("/species");
  return response.data.data;
};

// ———————————————— BREEDS API ————————————————
export const getBreeds = async (speciesID: number): Promise<Breed[]> => {
  const response = await axiosInstance.get("/breeds", {
    params: { speciesID },
  });
  return response.data.data;
};

// ———————————————— SHELTERS API ————————————————
export const getShelters = async (): Promise<Shelter[]> => {
  const response = await axiosInstance.get("/shelters");
  return response.data.data;
};

// ———————————————— PETS API ————————————————
export const getPets = async (
  filters: PetFilters,
  page: number,
  limit: number,
): Promise<PaginatedPets> => {
  const params: Record<string, string | number> = { page, limit };
  if (filters.speciesName) params.species = filters.speciesName;
  if (filters.breedName) params.breed = filters.breedName;
  if (filters.size) params.size = filters.size;
  if (filters.minAge) params.minAge = filters.minAge;
  if (filters.maxAge) params.maxAge = filters.maxAge;
  if (filters.shelterID != null) params.shelterID = filters.shelterID;

  const response = await axiosInstance.get("/pets", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};
