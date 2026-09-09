// Small date/time helpers shared across dashboard sections.

/** Time-of-day greeting, e.g. "Good morning" / "Good afternoon" / "Good evening". */
export const getGreeting = (date = new Date()): string => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/** Long, human-readable date, e.g. "Monday, June 1, 2026". */
export const formatLongDate = (date = new Date()): string =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** Compact date, e.g. "Jun 25, 2026". */
export const formatShortDate = (date = new Date()): string =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Full date, month spelled out, e.g. "March 02, 2025". */
export const formatFullDate = (date = new Date()): string =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });

/**
 * Relative badge for a scheduled event: "Soon" within the next 7 days,
 * "Upcoming" further out, "Past" once it has elapsed. Independent of any
 * stored status.
 */
export const relativeDateBadge = (
  date: Date,
  now = new Date(),
): "Soon" | "Upcoming" | "Past" => {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Past";
  return diffMs <= 7 * 24 * 60 * 60 * 1000 ? "Soon" : "Upcoming";
};
