// Shared presentation + rules for an adoption application's status — the
// adopter-facing label and badge colour differ from the raw DB enum ("Pending"
// reads as "Under Consideration", etc.). Shared so every place that shows an
// application status (the section list now, the detail view later) stays in
// sync.
import type { ApplicationStatus } from "../api/adoptersApi";

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  Pending: {
    label: "Under Consideration",
    className: "bg-gold-md text-white",
  },
  Accepted: { label: "Approved", className: "bg-green text-white" },
  Rejected: { label: "Declined", className: "bg-neutral-gray text-white" },
  Withdrawn: {
    label: "Withdrawn",
    className: "bg-neutral-lightgray text-neutral-charcoal",
  },
};

// The adopter can only withdraw an application that's still in play.
export const canWithdraw = (status: ApplicationStatus): boolean =>
  status === "Pending" || status === "Accepted";
