// Shared presentation for a pet's adoptionStatus on the staff side — the
// label and badge tone. Shared so every place that shows it (the Pets tab's
// All Pets cards, the pet panel, the Health Passport) stays in sync.
import type { PetAdoptionStatus } from "../api/staffPetsApi";
import type { BadgeTone } from "../../components/ui/Badge";

export const PET_STATUS_META: Record<
  PetAdoptionStatus,
  { label: string; tone: BadgeTone }
> = {
  incoming: { label: "Incoming", tone: "gold" },
  available: { label: "Available", tone: "teal" },
  adopted: { label: "Adopted", tone: "green" },
  fostered: { label: "Fostered", tone: "teal" },
  transferred: { label: "Transferred", tone: "neutral" },
  deceased: { label: "Deceased", tone: "red" },
};
