// vaccinationsApi.ts
// The vaccine catalog (GET /vaccines — Admin, Staff, Veterinarian; POST
// /vaccines and PUT /vaccines/:id — Veterinarian, Admin) and the
// doses given at an appointment (GET/POST /appointments/:id/vaccinations).
// Recording a dose is the appointment's assigned vet's; the server sets the
// pet, the vet, the shelter and the appointment link itself.
import axiosInstance from "./axiosInstance";

export interface Vaccine {
  vaccineID: number;
  vaccineName: string;
  manufacturer: string | null;
  vaccineDesc: string | null;
}

// Alphabetical. `name` narrows to a case-insensitive contains match.
export const getVaccines = async (name?: string): Promise<Vaccine[]> => {
  const response = await axiosInstance.get("/vaccines", {
    params: name ? { name } : undefined,
  });
  return response.data.data;
};

// The catalog is network-wide; writes are Veterinarian and Admin.
// vaccineName ≤45 (required), manufacturer ≤45, vaccineDesc ≤500 — the
// optional two clear with null. The same name from the same manufacturer
// (case-insensitive) is a 409.
export interface VaccinePayload {
  vaccineName: string;
  manufacturer: string | null;
  vaccineDesc: string | null;
}

export const createVaccine = async (payload: VaccinePayload): Promise<Vaccine> => {
  const response = await axiosInstance.post("/vaccines", payload);
  return response.data.data;
};

// Partial — only the fields sent change.
export const updateVaccine = async (
  vaccineID: number,
  payload: Partial<VaccinePayload>,
): Promise<Vaccine> => {
  const response = await axiosInstance.put(`/vaccines/${vaccineID}`, payload);
  return response.data.data;
};

export interface VaccinationDose {
  recordID: number;
  appointmentID: number;
  vaccineID: number;
  vaccineName: string;
  administeredDate: string;
  dueDate: string | null; // null = no further dose planned
  vetName: string | null;
  shelterName: string | null;
}

export interface RecordVaccinationPayload {
  vaccineID: number;
  administeredDate: string; // ISO — not in the future
  // ISO, after administeredDate. Omit or null: no further dose planned.
  dueDate?: string | null;
}

// 409 for a Cancelled appointment; 422 for a future administeredDate or a
// given dueDate that isn't after it.
export const recordVaccination = async (
  appointmentID: number,
  payload: RecordVaccinationPayload,
): Promise<VaccinationDose> => {
  const response = await axiosInstance.post(
    `/appointments/${appointmentID}/vaccinations`,
    payload,
  );
  return response.data.data;
};
