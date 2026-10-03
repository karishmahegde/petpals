// A dose's next-due date is optional — null means the vet planned no
// further dose (never overdue). Every screen that shows a dose's next-due
// date goes through these, so the wording stays the same everywhere.
import { formatShortDate } from "./datetime";

export const NO_FURTHER_DOSE = "No further dose planned";

// e.g. "Oct 9, 2026", or "No further dose planned".
export const formatNextDue = (dueDate: string | null): string =>
  dueDate ? formatShortDate(new Date(dueDate)) : NO_FURTHER_DOSE;

// With a lead-in, e.g. "Next due Oct 9, 2026" — or "No further dose
// planned" on its own (no lead-in) when there's no next dose.
export const describeNextDue = (dueDate: string | null, leadIn: string): string =>
  dueDate ? `${leadIn} ${formatShortDate(new Date(dueDate))}` : NO_FURTHER_DOSE;

export const isDoseOverdue = (dueDate: string | null): boolean =>
  dueDate !== null && new Date(dueDate).getTime() < Date.now();
