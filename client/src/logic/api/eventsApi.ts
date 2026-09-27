// What it does: API functions for the /events domain (Sprint 5.2). Public
// read (GET /events, GET /events/:id) — no auth required, same convention
// as petsApi.ts's GET /pets.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

// The EventCategory enum's stored values — display labels are
// EVENT_CATEGORY_LABEL in logic/eventCategory.ts.
export type EventCategory =
  | "Adoption_Event"
  | "Fundraiser"
  | "Volunteer_Orientation"
  | "Vaccination_Clinic"
  | "Community_Outreach"
  | "Workshop"
  | "Donation_Drive"
  | "Other";

export interface EventListItem {
  eventID: number;
  eventName: string;
  eventDate: string;
  eventDesc: string;
  eventCategory: EventCategory;
  // Where the event is held — shelter.shelterName.
  shelter: { shelterID: number; shelterName: string };
}

export interface EventDetail extends Omit<EventListItem, "shelter"> {
  shelter: { shelterID: number; shelterName: string; shelterAddress: string };
}

interface EventsListParams {
  shelterID?: number | number[]; // repeatable — any of these shelters
  upcoming?: boolean;
  past?: boolean; // already started, most recent first
  name?: string; // case-insensitive eventName match
  page?: number;
  limit?: number;
}

// upcoming: only events that haven't started yet, soonest first. past: only
// events already started, most recent first. Neither: everything, soonest
// first.
export const getEvents = async (
  params?: EventsListParams,
): Promise<{ data: EventListItem[]; pagination: Pagination }> => {
  const { upcoming, past, ...rest } = params ?? {};
  const response = await axiosInstance.get("/events", {
    params: {
      ...rest,
      ...(upcoming ? { upcoming: "true" } : {}),
      ...(past ? { past: "true" } : {}),
    },
  });
  return { data: response.data.data, pagination: response.data.pagination };
};

export const getEventById = async (eventID: number): Promise<EventDetail> => {
  const response = await axiosInstance.get(`/events/${eventID}`);
  return response.data.data;
};
