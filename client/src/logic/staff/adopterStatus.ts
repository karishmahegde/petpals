// adopterStatus.ts
// Badge tone per adopter account status — shared by the Adopters tab's
// list rows and AdopterDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { AdopterAccountStatus } from "../api/staffAdoptersApi";

export const ADOPTER_STATUS_TONE: Record<AdopterAccountStatus, BadgeTone> = {
  Active: "green",
  Banned: "red",
  Deactivated: "gray",
};
