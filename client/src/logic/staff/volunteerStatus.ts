// volunteerStatus.ts
// Badge tone per volunteer account status — shared by the Volunteers tab's
// list rows and VolunteerDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { VolunteerAccountStatus } from "../api/volunteersApi";

export const VOLUNTEER_STATUS_TONE: Record<VolunteerAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Banned: "red",
  Deactivated: "gray",
};
