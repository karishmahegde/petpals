// eventCategory.ts
// Per-EventCategory display data, shared by the staff Events tab and the
// public Events page: the label (also the event form's dropdown options, in
// this order) and the cover image.
import type { EventCategory } from "./api/eventsApi";

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  Adoption_Event: "Adoption Event",
  Fundraiser: "Fundraiser",
  Volunteer_Orientation: "Volunteer Orientation",
  Vaccination_Clinic: "Vaccination Clinic",
  Community_Outreach: "Community Outreach",
  Workshop: "Workshop",
  Donation_Drive: "Donation Drive",
  Other: "Other",
};

// Cover images live in static/assets/images/events/, one per category, named
// after the enum value (e.g. Adoption_Event.jpg — jpg/png/webp all work).
// Globbed rather than imported one by one so a missing file just means no
// image for that category (EventImage shows a placeholder), not a broken
// build.
const imageModules = import.meta.glob<string>(
  "../static/assets/images/events/*.{jpg,jpeg,png,webp}",
  { eager: true, import: "default" },
);

export const EVENT_CATEGORY_IMAGE: Partial<Record<EventCategory, string>> =
  Object.fromEntries(
    Object.entries(imageModules).map(([path, url]) => [
      path.split("/").pop()!.replace(/\.\w+$/, ""),
      url,
    ]),
  );
