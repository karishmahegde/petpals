// PetDetailPanel.tsx
// Slide-over for a pet the adopter has adopted — opened from the "My Pets" tab
// (and deep-linked via ?petID from the Overview widget). Replaces the public
// PetDetailsModal in this context: an adopted pet needs the health history and
// adoption record, not the "Adopt or Foster" call to action.
//
// Enters from the right on sm+ (a side drawer); on mobile it's a bottom sheet
// that slides up with rounded top corners — same responsive shape as
// PetDetailsModal.
//
// State (which pet is open) is owned by Pets.tsx — this panel only renders what
// it's handed and reports close via onClose (State Ownership Rule). The panel
// stays mounted while closed (petID flips to null and it renders null), so the
// slide-in transition is re-armed on every open via the `entered` flag, same
// trick as PetDetailsModal.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaPaw, FaTimes } from "react-icons/fa";
import { getAdoptedPetDetail } from "../../../../../logic/api/adoptersApi";
import SegmentedControl from "../../../../../components/ui/SegmentedControl";
import {
  formatShortDate,
  formatNumericDate,
  formatTime,
} from "../../../../../logic/utils/datetime";

type HealthTab = "vaccinations" | "appointments";
const HEALTH_TABS = [
  { value: "vaccinations", label: "Vaccinations" },
  { value: "appointments", label: "Appointments" },
];

interface PetDetailPanelProps {
  petID: number | null;
  onClose: () => void;
}

const sectionTitle = "font-display text-lg text-neutral-dark";
const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const divider = "my-5 border-t border-neutral-lightgray";
const quoteBlock = "font-body text-sm italic text-neutral-charcoal";

const yesNo = (b: boolean) => (b ? "Yes" : "No");

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const PetDetailPanel = ({ petID, onClose }: PetDetailPanelProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "adopted-pet", petID],
    queryFn: () => getAdoptedPetDetail(petID!),
    enabled: petID !== null,
  });

  // Which Health History tab is showing — resets to the first tab on every
  // new pet opened.
  const [healthTab, setHealthTab] = useState<HealthTab>("vaccinations");

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (petID === null) return;
    setEntered(false);
    setHealthTab("vaccinations");
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [petID]);

  if (petID === null) return null;

  const vaccinations = data?.health.vaccinations ?? [];
  const appointments = data?.health.appointments ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-stretch sm:justify-end"
      onClick={onClose}
    >
      <div
        className={`w-full overflow-y-auto rounded-t-2xl bg-white font-body shadow-xl transition-transform duration-300 ease-out max-h-[90vh] sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none ${
          entered
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-4">
          <h1 className="font-display text-2xl text-neutral-dark">
            Pet Details
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </button>
        </div>

        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading pet details…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load pet details. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Summary card */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {data.petPhoto ? (
                <img
                  src={data.petPhoto}
                  alt={`${data.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.petName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.breed.breedName} · {data.adoption.shelterName}
                </p>
              </div>
              {data.adoptionStatus === "adopted" && (
                <span className="shrink-0 rounded-full bg-gold-md px-3 py-1 text-xs font-medium text-white">
                  Adopted
                </span>
              )}
            </div>

            {/* Basic details */}
            <dl className="mt-5 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="ID" v={data.petCode} />
              <InfoRow k="Microchip ID" v={data.microchipID || "—"} />
              <InfoRow k="Age" v={data.petAge} />
              <InfoRow
                k="Date of Birth"
                v={formatShortDate(new Date(data.petDOB))}
              />
              <InfoRow k="Sex" v={data.petSex} />
              <InfoRow k="Color" v={data.petColor} />
              <InfoRow k="Size" v={data.petSize ?? "—"} />
              <InfoRow k="Blood Group" v={data.petBGroup} />
              <InfoRow k="Height" v={`${data.petHeight} cm`} />
              <InfoRow k="Weight" v={`${data.petWeight} kg`} />
            </dl>

            {/* Personality */}
            <div className={divider} />
            <h2 className={sectionTitle}>Personality</h2>
            <p className={`mt-2 ${quoteBlock}`}>
              {data.petDesc ? `"${data.petDesc}"` : "No description on file."}
            </p>

            {/* Compatibility */}
            <div className={divider} />
            <h2 className={sectionTitle}>Compatibility</h2>
            <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Children" v={yesNo(data.compatibility.children)} />
              <InfoRow k="Other Pets" v={yesNo(data.compatibility.otherPets)} />
              <dt className={label}>Special Needs?</dt>
              <dd
                className={
                  data.compatibility.specialNeeds
                    ? "font-body text-sm font-semibold text-gold-dark"
                    : value
                }
              >
                {yesNo(data.compatibility.specialNeeds)}
              </dd>
            </dl>

            {/* Health history */}
            <div className={divider} />
            <h2 className={sectionTitle}>🩺 Health History</h2>

            <SegmentedControl
              className="mt-3"
              options={HEALTH_TABS}
              value={healthTab}
              onChange={(v) => setHealthTab(v as HealthTab)}
            />

            {healthTab === "vaccinations" &&
              (vaccinations.length === 0 ? (
                <p className="mt-3 font-body text-xs text-neutral-gray">
                  No vaccination records.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {vaccinations.map((v) => (
                    <li
                      key={v.recordID}
                      className="rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3"
                    >
                      <p className="font-body text-sm font-semibold text-neutral-charcoal">
                        {v.vaccineName}
                      </p>
                      <p className="font-body text-xs text-neutral-gray">
                        Given {formatShortDate(new Date(v.administeredDate))} ·
                        due {formatShortDate(new Date(v.dueDate))}
                        {v.vetName ? ` · ${v.vetName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ))}

            {healthTab === "appointments" &&
              (appointments.length === 0 ? (
                <p className="mt-3 font-body text-xs text-neutral-gray">
                  No appointments on record.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {appointments.map((a) => (
                    <li
                      key={a.appointmentID}
                      className="rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3"
                    >
                      <p className="font-body text-sm font-semibold text-neutral-charcoal">
                        {a.appointmentReason}
                      </p>
                      <p className="font-body text-xs text-neutral-gray">
                        {formatShortDate(new Date(a.appointmentDate))}
                        {a.vetName ? ` · ${a.vetName}` : ""}
                        {a.shelterName ? ` · ${a.shelterName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ))}

            {/* Adoption details */}
            <div className={divider} />
            <h2 className={sectionTitle}>🏠 Adoption Details</h2>
            <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2">
              <InfoRow
                k="Adopted On"
                v={formatNumericDate(new Date(data.adoption.adoptedOn))}
              />
              <InfoRow
                k="Adoption Time"
                v={formatTime(new Date(data.adoption.adoptedOn))}
              />
              <InfoRow k="Shelter" v={data.adoption.shelterName} />
              <InfoRow k="Location" v={data.adoption.shelterAddress} />
            </dl>

            <h3 className="mt-4 font-body text-sm font-semibold text-neutral-dark">
              Your Message
            </h3>
            <p className={`mt-1 ${quoteBlock}`}>
              {data.adoption.yourMessage
                ? `"${data.adoption.yourMessage}"`
                : "No message was sent with this application."}
            </p>

            <h3 className="mt-4 font-body text-sm font-semibold text-neutral-dark">
              Remarks from Shelter
            </h3>
            <p className={`mt-1 ${quoteBlock}`}>
              {data.adoption.staffRemark
                ? `"${data.adoption.staffRemark}"`
                : "No remarks from the shelter yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetDetailPanel;
