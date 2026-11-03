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

// How the adopter can end an application that's still in play: withdraw it
// while it's under consideration, or surrender the pet once it's approved
// (the pet goes back to the shelter as incoming). Both send status
// "Withdrawn"; null = nothing to end.
export type ReleaseAction = "withdraw" | "surrender";

export const releaseActionFor = (
  status: ApplicationStatus,
): ReleaseAction | null =>
  status === "Pending"
    ? "withdraw"
    : status === "Accepted"
      ? "surrender"
      : null;

export const RELEASE_ACTION_COPY: Record<
  ReleaseAction,
  {
    rowLabel: string;
    panelLabel: string;
    modalTitle: string;
    confirmLabel: string;
    successToast: string;
    errorToast: string;
  }
> = {
  withdraw: {
    rowLabel: "Withdraw",
    panelLabel: "Withdraw Application",
    modalTitle: "Withdraw application?",
    confirmLabel: "Withdraw",
    successToast: "Application withdrawn",
    errorToast: "Couldn't withdraw the application. Please try again.",
  },
  surrender: {
    rowLabel: "Surrender",
    panelLabel: "Surrender Pet",
    modalTitle: "Surrender this pet?",
    confirmLabel: "Surrender",
    successToast: "Pet surrendered to the shelter",
    errorToast: "Couldn't surrender the pet. Please try again.",
  },
};
