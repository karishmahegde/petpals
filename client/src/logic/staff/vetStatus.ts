// vetStatus.ts
// Badge tone per vet account status — shared by the Vets tab's list rows and
// VetDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { VetAccountStatus } from "../api/shelterVetsApi";

export const VET_STATUS_TONE: Record<VetAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
  Closed: "neutral",
  Declined: "rose",
};
