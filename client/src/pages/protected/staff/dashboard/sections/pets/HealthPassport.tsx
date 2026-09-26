// HealthPassport.tsx
// Full-page, read-only "health passport" view for one pet — reached via the
// Pets tab's "View Health Passport" button (PetFormPanel.tsx's view-mode
// footer). Not a SlideOver — a real routed page
// (/staff/pets/:petID/health-passport), the same :petID-param-route shape
// the adopter apply funnel already uses, extended to staff for the first
// time (every other staff "detail" view today is a SlideOver). Four
// sections: Identity Card, Health Records, Vaccinations, and Transfer
// History (network-wide, not scoped to the viewer's own shelter — see
// staffPetsApi.ts's getHealthPassport). Creating new health
// records/vaccinations is out of scope here — that's the Vet role's future
// dashboard; this only displays what already exists.
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaArrowLeft, FaPaw } from "react-icons/fa";
import Card from "../../../../../../components/ui/Card";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import DashboardEmptyMessage from "../../../../../../components/ui/dashboard/DashboardEmptyMessage";
import { formatShortDate } from "../../../../../../logic/utils/datetime";
import {
  getHealthPassport,
  type VaccinationStatus,
} from "../../../../../../logic/api/staffPetsApi";
import { PET_STATUS_META } from "../../../../../../logic/staff/petStatus";
import { formatVetName } from "../../../../../../logic/utils/vetName";

const VACCINATION_TONE: Record<VaccinationStatus, BadgeTone> = {
  Overdue: "red",
  "Due Soon": "gold",
  "Up to Date": "green",
};

const TRANSFER_STATUS_LABEL: Record<string, string> = {
  In_Progress: "In Progress",
  Completed: "Completed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

const TRANSFER_STATUS_TONE: Record<string, BadgeTone> = {
  In_Progress: "gold",
  Completed: "green",
  Rejected: "red",
  Cancelled: "gray",
};

const sectionHeading = "flex items-center gap-2 font-display text-xl text-neutral-dark";
const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const HealthPassport = () => {
  const { petID: petIDParam } = useParams<{ petID: string }>();
  const navigate = useNavigate();
  const petID = Number(petIDParam);
  const isValidPetID = Number.isInteger(petID) && petID > 0;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "health-passport", petID],
    queryFn: () => getHealthPassport(petID),
    enabled: isValidPetID,
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ButtonElement
          onClick={() => navigate("/staff/pets")}
          aria-label="Back to Pets"
          size="bare"
          variant="outline"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-dark hover:bg-neutral-lightgray"
        >
          <FaArrowLeft />
        </ButtonElement>
        <h1 className={sectionHeading}>
          <span aria-hidden>🩺</span> Health Passport
        </h1>
      </div>

      {!isValidPetID && (
        <p className="font-body text-sm text-rose-dark">Invalid pet ID.</p>
      )}
      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}
      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load this pet's health passport. Please try again.
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {/* Identity Card */}
          <Card className="p-6">
            <h2 className={`${sectionHeading} mb-4`}>
              <span aria-hidden>🐾</span> Identity Card
            </h2>
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {data.pet.petPhoto ? (
                <img
                  src={data.pet.petPhoto}
                  alt={`${data.pet.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.pet.petName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.pet.breed.breedName} · {data.pet.breed.speciesName} ·{" "}
                  {data.pet.petAge}
                </p>
              </div>
              <Badge
                tone={PET_STATUS_META[data.pet.adoptionStatus].tone}
                className="shrink-0"
              >
                {PET_STATUS_META[data.pet.adoptionStatus].label}
              </Badge>
            </div>

            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="ID" v={data.pet.petCode} />
              <InfoRow k="Microchip ID" v={data.pet.microchipID || "—"} />
              <InfoRow k="Sex" v={data.pet.petSex} />
              <InfoRow k="Color" v={data.pet.petColor} />
              <InfoRow k="Size" v={data.pet.petSize ?? "—"} />
              <InfoRow k="Blood Group" v={data.pet.petBGroup} />
              <InfoRow
                k="Height / Weight"
                v={`${data.pet.petHeight} cm / ${data.pet.petWeight} kg`}
              />
              <InfoRow k="Shelter" v={data.pet.shelter.shelterName} />
            </dl>
          </Card>

          {/* Health Records */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={sectionHeading}>
                <span aria-hidden>📁</span> Health Records
              </h2>
              <ButtonElement
                disabled
                title="AI summaries aren't available yet"
                size="sm"
                className="cursor-not-allowed bg-rose-md"
              >
                ✨ Summarize with AI
              </ButtonElement>
            </div>

            {data.healthRecords.length === 0 ? (
              <DashboardEmptyMessage>
                No health records on file.
              </DashboardEmptyMessage>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.healthRecords.map((record) => (
                  <li
                    key={record.recordID}
                    className="rounded-xl bg-teal-light p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div>
                      <p className="font-body text-xs font-semibold text-neutral-charcoal">
                        {formatShortDate(new Date(record.createdAt))}
                      </p>
                      <p className="mt-1 font-body text-sm text-neutral-charcoal">
                        {record.recordDesc}
                      </p>
                    </div>
                    {(record.vetName || record.shelterName) && (
                      <p className="mt-2 shrink-0 font-body text-xs text-neutral-gray sm:mt-0 sm:text-right">
                        {record.vetName && formatVetName(record.vetName)}
                        {record.vetName && record.shelterName ? " · " : ""}
                        {record.shelterName}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Vaccinations */}
          <Card className="p-6">
            <h2 className={`${sectionHeading} mb-4`}>
              <span aria-hidden>💉</span> Vaccinations
            </h2>

            {data.vaccinations.length === 0 ? (
              <DashboardEmptyMessage>
                No vaccination records on file.
              </DashboardEmptyMessage>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.vaccinations.map((vax) => (
                  <li
                    key={vax.recordID}
                    className="flex items-center justify-between gap-4 rounded-xl bg-rose-lightest p-4"
                  >
                    <div>
                      <p className="font-body text-sm font-semibold text-neutral-charcoal">
                        {vax.vaccineName}
                      </p>
                      <p className="mt-1 font-body text-xs text-neutral-gray">
                        Administered: {formatShortDate(new Date(vax.administeredDate))}
                      </p>
                      <p className="font-body text-xs text-neutral-gray">
                        Due Date: {formatShortDate(new Date(vax.dueDate))}
                      </p>
                    </div>
                    <Badge tone={VACCINATION_TONE[vax.status]} className="shrink-0">
                      {vax.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Transfer History */}
          <Card className="p-6">
            <h2 className={`${sectionHeading} mb-4`}>
              <span aria-hidden>🔄</span> Transfer History
            </h2>

            {data.transferHistory.length === 0 ? (
              <DashboardEmptyMessage>
                No transfer history yet.
              </DashboardEmptyMessage>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.transferHistory.map((transfer) => (
                  <li
                    key={transfer.recordID}
                    className="rounded-xl bg-teal-light p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div>
                      <p className="font-body text-xs font-semibold text-neutral-charcoal">
                        {formatShortDate(new Date(transfer.transferDate))}
                      </p>
                      <p className="mt-1 font-body text-sm font-medium text-neutral-charcoal">
                        {transfer.fromShelterName} → {transfer.toShelterName}
                      </p>
                      <p className="mt-1 font-body text-xs text-neutral-gray">
                        Notes: {transfer.transferReason}
                      </p>
                    </div>
                    <Badge
                      tone={TRANSFER_STATUS_TONE[transfer.transferStatus]}
                      className="mt-2 shrink-0 sm:mt-0"
                    >
                      {TRANSFER_STATUS_LABEL[transfer.transferStatus]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default HealthPassport;
