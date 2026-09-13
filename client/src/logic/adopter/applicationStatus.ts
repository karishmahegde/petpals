// Shared presentation + rules for an adoption application's status — the
// adopter-facing label and badge tone differ from the raw DB enum ("Pending"
// reads as "Under Consideration", etc.). Shared so every place that shows an
// application status (the section list, the detail slide-over) stays in sync.
import type { ApplicationStatus } from "../api/adoptersApi";
import type { BadgeTone } from "../../components/ui/Badge";

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; tone: BadgeTone }
> = {
  Pending: { label: "Under Consideration", tone: "gold" },
  Accepted: { label: "Approved", tone: "green" },
  Rejected: { label: "Declined", tone: "gray" },
  Withdrawn: { label: "Withdrawn", tone: "gray" },
};

// The adopter can only withdraw an application that's still in play.
export const canWithdraw = (status: ApplicationStatus): boolean =>
  status === "Pending" || status === "Accepted";
