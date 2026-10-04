// A volunteer's weekly availability — days (Mon–Sun) × slots (Morning,
// Afternoon, Evening), the same structured form the API sends and accepts
// (server/src/utils/availability.js). `null` from the API means the stored
// schedule is older free text, not in this form — show the raw
// volunteerSchedule instead.
export const AVAILABILITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const AVAILABILITY_SLOTS = ["Morning", "Afternoon", "Evening"] as const;

export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];
export type AvailabilitySlot = (typeof AVAILABILITY_SLOTS)[number];
export type Availability = Partial<Record<AvailabilityDay, AvailabilitySlot[]>>;

// The hours each slot stands for — display only (the API stores just the
// slot name), shown under the grid's column headers.
export const AVAILABILITY_SLOT_HOURS: Record<AvailabilitySlot, string> = {
  Morning: "8 AM – 12 PM",
  Afternoon: "12 PM – 5 PM",
  Evening: "5 PM – 9 PM",
};

export const isAvailable = (
  availability: Availability,
  day: AvailabilityDay,
  slot: AvailabilitySlot,
): boolean => availability[day]?.includes(slot) ?? false;

export const hasAnyAvailability = (availability: Availability): boolean =>
  AVAILABILITY_DAYS.some((day) => (availability[day]?.length ?? 0) > 0);
