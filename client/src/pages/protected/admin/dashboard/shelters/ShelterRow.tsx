// ShelterRow.tsx
// One shelter card in the Shelters tab list: name/address + contact info +
// Edit, a divider, then a 2x2 stat grid (Animals, Staff, Manager, Transfers).
// Status and manager are edited via the Edit panel (ShelterFormPanel), not
// inline here — this row is read-only aside from the Edit button.
import { FaPhoneAlt, FaEnvelope, FaEdit } from "react-icons/fa";
import { RowActionButton } from "../../../../../components/ui/dashboard/DashboardList";
import type { ShelterAnalyticsItem } from "../../../../../logic/api/analyticsApi";
import { formatPhoneDisplay } from "../../../../../logic/utils/phone";

interface ShelterRowProps {
  shelter: ShelterAnalyticsItem;
  onEdit: (shelter: ShelterAnalyticsItem) => void;
}

const ShelterRow = ({ shelter, onEdit }: ShelterRowProps) => (
  <div className="rounded-2xl bg-gold-lightest p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-display text-lg text-neutral-dark">
          {shelter.shelterName}
        </p>
        <p className="font-body text-sm text-neutral-gray">
          {shelter.shelterAddress} - {shelter.shelterZIP}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 font-body text-sm text-neutral-charcoal sm:flex-row sm:items-center sm:gap-6">
        <span className="flex items-center gap-2">
          <FaPhoneAlt className="text-red" aria-hidden />
          {formatPhoneDisplay(shelter.shelterPhone)}
        </span>
        <span className="flex items-center gap-2">
          <FaEnvelope className="text-neutral-gray" aria-hidden />
          {shelter.shelterEmail}
        </span>
      </div>

      <RowActionButton onClick={() => onEdit(shelter)}>
        <span className="flex items-center gap-1.5">
          <FaEdit aria-hidden /> Edit
        </span>
      </RowActionButton>
    </div>

    <hr className="my-4 border-neutral-lightgray" />

    <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-body text-sm text-neutral-charcoal">
      <p>
        <span className="font-semibold">Animals:</span> {shelter.petCount}/
        {shelter.shelterSize}
      </p>
      <p>
        <span className="font-semibold">Staff:</span> {shelter.staffCount}
      </p>
      <p>
        <span className="font-semibold">Manager:</span>{" "}
        {shelter.managerName ?? "—"}
      </p>
      {/* Transfers isn't a built domain yet (see CLAUDE.md — Transfers lands
          later) — placeholder 0, same convention as the adopter dashboard's
          not-yet-built Appointments stat. */}
      <p>
        <span className="font-semibold">Transfers:</span> 0
      </p>
    </div>
  </div>
);

export default ShelterRow;
