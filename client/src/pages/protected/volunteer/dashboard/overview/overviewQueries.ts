// overviewQueries.ts
// The volunteer Overview's queries, each shared by its stat tile
// (StatsWidget reads pagination.total) and its widget (reads the rows), so
// both read one request. Keys sit under ["volunteer", "tasks" | "events" |
// "appointments"], so the tabs can invalidate a whole prefix.
import {
  getMyVolunteerAppointments,
  getMyVolunteerEvents,
  getMyVolunteerTasks,
} from "../../../../../logic/api/volunteersApi";

// Rows each widget shows; the tiles count the full total regardless.
const PREVIEW_LIMIT = 4;

// Open tasks (overdue included), soonest due first — the overdue ones
// therefore lead.
const activeTasksParams = { taskStatus: "In_progress" as const, limit: PREVIEW_LIMIT };
export const activeTasksQuery = {
  queryKey: ["volunteer", "tasks", activeTasksParams],
  queryFn: () => getMyVolunteerTasks(activeTasksParams),
};

// Events staff have put this volunteer on that haven't started yet.
const nextEventsParams = { assigned: true, upcoming: true, limit: PREVIEW_LIMIT };
export const nextEventsQuery = {
  queryKey: ["volunteer", "events", nextEventsParams],
  queryFn: () => getMyVolunteerEvents(nextEventsParams),
};

// Events they were on that have already started — tile only, so one row
// is enough to get the total.
const eventsServedParams = { assigned: true, upcoming: false, limit: 1 };
export const eventsServedQuery = {
  queryKey: ["volunteer", "events", eventsServedParams],
  queryFn: () => getMyVolunteerEvents(eventsServedParams),
};

// Scheduled appointments they're assisting that are still ahead.
const upcomingAppointmentsParams = { upcoming: true, limit: PREVIEW_LIMIT };
export const upcomingAppointmentsQuery = {
  queryKey: ["volunteer", "appointments", upcomingAppointmentsParams],
  queryFn: () => getMyVolunteerAppointments(upcomingAppointmentsParams),
};
