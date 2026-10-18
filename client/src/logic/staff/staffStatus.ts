// staffStatus.ts
// Badge tone per staff account status — shared by the manager's Staff tab
// list rows and its StaffDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { StaffAccountStatus } from "../api/staffApi";

export const STAFF_STATUS_TONE: Record<StaffAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
  Closed: "neutral",
  Declined: "rose",
};
