// What it does: API functions for the /appointments domain — Staff/Admin
// only; adopters only ever read their own pets' appointments via
// adoptersApi.ts's getMyAppointments/getAppointmentDetail, a separate
// read-only surface.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export type AppointmentStatus = "Scheduled" | "Completed" | "Cancelled";

// Row shape for GET /appointments.
export interface AppointmentQueueItem {
  appointmentID: number;
  appointmentDate: string;
  appointmentReason: string;
  status: AppointmentStatus;
  pet: {
    petID: number;
    petName: string;
    petPhoto: string | null;
    breedName: string;
    speciesName: string;
  };
  vetName: string;
}

// Richer shape from GET /appointments/:id — for the detail slide-over.
export interface AppointmentDetail extends AppointmentQueueItem {
  appointmentCode: string | null;
  shelterName: string;
  vetID: number;
  staffID: number | null;
  volunteerID: number | null;
  staffName: string | null;
  volunteerName: string | null;
  vaccinesAdministered: {
    recordID: number;
    vaccineName: string;
    dueDate: string;
  }[];
  adopter: {
    adopterName: string;
    adopterPhone: string | null;
    adopterEmail: string;
    address: string;
  } | null;
}

interface AppointmentsQueueParams {
  upcoming?: boolean;
  vetID?: number;
  petName?: string;
  shelterID?: number; // Admin only
  page?: number;
  limit?: number;
}

export const getAppointmentsQueue = async (
  params: AppointmentsQueueParams,
): Promise<{ data: AppointmentQueueItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/appointments", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getAppointmentDetail = async (
  appointmentID: number,
): Promise<AppointmentDetail> => {
  const response = await axiosInstance.get(`/appointments/${appointmentID}`);
  return response.data.data;
};

export interface CreateAppointmentPayload {
  petID: number;
  vetID: number;
  volunteerID?: number;
  staffID?: number; // omitted -> defaults to the acting Staff member
  appointmentDate: string;
  appointmentReason: string;
  shelterID?: number; // Admin only
}

export const createAppointment = async (
  payload: CreateAppointmentPayload,
): Promise<AppointmentDetail> => {
  const response = await axiosInstance.post("/appointments", payload);
  return response.data.data;
};

// Scheduled + upcoming only; the pet can't be changed. volunteerID null
// unassigns. Same double-booking guard as create (409).
export interface UpdateAppointmentPayload {
  vetID?: number;
  staffID?: number;
  volunteerID?: number | null;
  appointmentDate?: string;
  appointmentReason?: string;
}

export const updateAppointment = async (
  appointmentID: number,
  payload: UpdateAppointmentPayload,
): Promise<AppointmentDetail> => {
  const response = await axiosInstance.patch(
    `/appointments/${appointmentID}`,
    payload,
  );
  return response.data.data;
};

// Only valid on a Scheduled, upcoming appointment.
export const cancelAppointment = async (
  appointmentID: number,
): Promise<AppointmentDetail> => {
  const response = await axiosInstance.patch(`/appointments/${appointmentID}/cancel`);
  return response.data.data;
};

// Minimal rosters for the appointment form's/filter bar's dropdowns — not a
// general vet/volunteer management API.
export interface VetOption {
  vetID: number;
  vetName: string;
}

export interface VolunteerOption {
  volunteerID: number;
  volunteerName: string;
}

export interface StaffOption {
  staffID: number;
  staffName: string;
}

export const getShelterVets = async (): Promise<VetOption[]> => {
  const response = await axiosInstance.get("/appointments/vets");
  return response.data.data;
};

export const getShelterVolunteers = async (): Promise<VolunteerOption[]> => {
  const response = await axiosInstance.get("/appointments/volunteers");
  return response.data.data;
};

export const getShelterStaff = async (): Promise<StaffOption[]> => {
  const response = await axiosInstance.get("/appointments/staff");
  return response.data.data;
};
