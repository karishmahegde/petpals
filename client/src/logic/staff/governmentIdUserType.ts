// governmentIdUserType.ts
// Label + badge tone per person type in the ID Verification queue — shared
// by its list rows and GovernmentIdDetailPanel.
import type { BadgeTone } from "../../components/ui/Badge";
import type { GovernmentIdUserType } from "../api/staffGovernmentIdsApi";

export const GOVERNMENT_ID_USER_TYPE_META: Record<
  GovernmentIdUserType,
  { label: string; tone: BadgeTone }
> = {
  Adopter: { label: "Adopter", tone: "teal" },
  Volunteer: { label: "Volunteer", tone: "rose" },
  Staff: { label: "Staff", tone: "neutral" },
  Veterinarian: { label: "Vet", tone: "gold" },
  Admin: { label: "Admin", tone: "gray" },
};

// The badge for a queue row/panel. Admin only ever sees Managers among
// staff (server-side rule), so their "Staff" rows read "Manager".
export const governmentIdTypeBadge = (
  userType: GovernmentIdUserType,
  scope: "staff" | "admin",
): { label: string; tone: BadgeTone } =>
  scope === "admin" && userType === "Staff"
    ? { ...GOVERNMENT_ID_USER_TYPE_META.Staff, label: "Manager" }
    : GOVERNMENT_ID_USER_TYPE_META[userType];
