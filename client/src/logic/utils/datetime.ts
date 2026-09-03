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
