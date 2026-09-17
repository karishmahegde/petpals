// What it does: API functions for the /events domain (Sprint 5.2). Public
// read (GET /events, GET /events/:id) — no auth required, same convention
// as petsApi.ts's GET /pets.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

export interface EventListItem {
  eventID: number;
  eventName: string;
  eventDate: string;
  eventDesc: string;
  // Snapshot of the hosting shelter's name at event-creation time — not
  // client-editable, see server/.../events.service.js's design note.
  eventLocation: string;
  shelter: { shelterID: number; shelterName: string };
}

export interface EventDetail extends Omit<EventListItem, "shelter"> {
  shelter: { shelterID: number; shelterName: string; shelterAddress: string };
}

interface EventsListParams {
  shelterID?: number;
  page?: number;
  limit?: number;
}

// Ordered by eventDate ascending. No "upcoming only" filter exists
// server-side yet — callers that need nearest-upcoming (e.g. the Staff
// Overview Upcoming Events widget) filter the returned page client-side.
export const getEvents = async (
  params?: EventsListParams,
): Promise<{ data: EventListItem[]; pagination: Pagination }> => {
  const response = await axiosInstance.get("/events", { params });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getEventById = async (eventID: number): Promise<EventDetail> => {
  const response = await axiosInstance.get(`/events/${eventID}`);
  return response.data.data;
};
