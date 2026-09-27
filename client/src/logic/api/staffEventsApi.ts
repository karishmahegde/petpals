// What it does: Staff/Admin event-management API — create/update/delete and
// assigned volunteers for the Events tab. Separate file from eventsApi.ts (public read-only), same
// convention as staffPetsApi.ts living apart from petsApi.ts.
import axiosInstance from "./axiosInstance";
import type { EventCategory, EventDetail } from "./eventsApi";

// shelterID is never a body field for Staff — taken from the acting staff
// member's own shelter server-side. eventDate must not be in the past on
// create (unenforced on update — see server/.../events.controller.js).
export interface EventFormPayload {
  eventName: string;
  eventDesc: string;
  eventDate: string; // ISO datetime
  eventCategory: EventCategory;
  // Active volunteers at this shelter. Optional on create; on update replaces
  // the whole assigned set ([] = none).
  volunteerIDs?: number[];
}

export interface EventVolunteer {
  volunteerID: number;
  volunteerName: string;
}

// Staff-only (not part of the public GET /events/:id), sorted by name.
export const getEventVolunteers = async (
  eventID: number,
): Promise<EventVolunteer[]> => {
  const response = await axiosInstance.get(`/events/${eventID}/volunteers`);
  return response.data.data;
};

export const createEvent = async (
  payload: EventFormPayload,
): Promise<EventDetail> => {
  const response = await axiosInstance.post("/events", payload);
  return response.data.data;
};

// Partial update — only send the fields to change.
export const updateEvent = async (
  eventID: number,
  payload: Partial<EventFormPayload>,
): Promise<EventDetail> => {
  const response = await axiosInstance.put(`/events/${eventID}`, payload);
  return response.data.data;
};

// Staff may only delete events at their own shelter (403 otherwise,
// server-enforced). Removes volunteer signups for the event along with it.
export const deleteEvent = async (eventID: number): Promise<void> => {
  await axiosInstance.delete(`/events/${eventID}`);
};
