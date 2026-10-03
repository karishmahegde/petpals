// HealthPassport.tsx
// Full-page, read-only "health passport" view for one pet. Shared by Staff
// (/staff/pets/:petID/health-passport — the Pets tab's "View Health
// Passport" button) and Veterinarian
// (/vet/health-records/:petID/health-passport — the Health Records tab
// and the Overview's Overdue Vaccinations widget). Both endpoints return
// the same shape from the same server service; `role` picks the endpoint, cache key and
// where Back goes. Not a SlideOver — a real routed page. Four sections:
// Identity Card, Health Records, Vaccinations, and Transfer History
// (network-wide, not scoped to the viewer's own shelter — the passport is
// universal). Read-only for Staff; a vet can also add a standalone health
// note (AddHealthRecordModal). Doses are recorded from an appointment, not
// here.
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaArrowLeft, FaPaw, FaPlus } from "react-icons/fa";
import { PiSparkleFill } from "react-icons/pi";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../components/ui/Badge";
import DashboardEmptyMessage from "../../../components/ui/dashboard/DashboardEmptyMessage";
import { formatShortDate } from "../../../logic/utils/datetime";
import {
  getHealthPassport,
  type HealthPassportData,
  type VaccinationStatus,
} from "../../../logic/api/staffPetsApi";
import { getMyVetPetHealthPassport } from "../../../logic/api/vetsApi";
import { PET_STATUS_META } from "../../../logic/staff/petStatus";
import { formatVetName } from "../../../logic/utils/vetName";
import { formatNextDue } from "../../../logic/utils/vaccination";
import AddHealthRecordModal from "./AddHealthRecordModal";

const VACCINATION_TONE: Record<VaccinationStatus, BadgeTone> = {
  Overdue: "red",
  "Due Soon": "gold",
  "Up to Date": "green",
  "No Further Dose": "gray",
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

const sectionHeading =
  "flex items-center gap-2 font-display text-2xl text-neutral-dark";

// "May, 01" over "2026" — the left-hand date block on record/transfer rows.
const DateBlock = ({ iso }: { iso: string }) => {
  const date = new Date(iso);
  return (
    <p className="shrink-0 font-body text-sm font-bold leading-tight text-neutral-charcoal sm:w-28">
      {date.toLocaleDateString("en-US", { month: "short" })},{" "}
      {date.toLocaleDateString("en-US", { day: "2-digit" })}
      <br />
      {date.getFullYear()}
    </p>
  );
};

// Identity-card fact: bold label, value beside it.
const Fact = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-x-2 font-body text-sm">
    <dt className="font-semibold text-neutral-charcoal">{k}:</dt>
    <dd className="text-neutral-charcoal">{v}</dd>
  </div>
);

// A multi-line note reads as a bullet list (one finding per line), a
// one-liner as plain text.
const RecordDesc = ({ text }: { text: string }) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return <p className="font-body text-sm text-neutral-charcoal">{text}</p>;
  }
  return (
    <ul className="list-disc space-y-0.5 pl-5 font-body text-sm text-neutral-charcoal">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
};

type PassportRole = "Staff" | "Veterinarian";

const ROLE_CONFIG: Record<
  PassportRole,
  {
    queryKeyRoot: string;
    fetch: (petID: number) => Promise<HealthPassportData>;
    backTo: string;
    backLabel: string;
  }
> = {
  Staff: {
    queryKeyRoot: "staff",
    fetch: getHealthPassport,
    backTo: "/staff/pets",
    backLabel: "Back to Pets",
  },
  Veterinarian: {
    queryKeyRoot: "vet",
    fetch: getMyVetPetHealthPassport,
    backTo: "/vet/health-records",
    backLabel: "Back to Health Records",
  },
};

interface HealthPassportProps {
  role: PassportRole;
}

const HealthPassport = ({ role }: HealthPassportProps) => {
  const { petID: petIDParam } = useParams<{ petID: string }>();
  const navigate = useNavigate();
  const petID = Number(petIDParam);
  const isValidPetID = Number.isInteger(petID) && petID > 0;
  const config = ROLE_CONFIG[role];
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);

  const passportQueryKey = [config.queryKeyRoot, "health-passport", petID];
  const { data, isLoading, isError } = useQuery({
    queryKey: passportQueryKey,
    queryFn: () => config.fetch(petID),
    enabled: isValidPetID,
  });

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <ButtonElement
          onClick={() => navigate(config.backTo)}
          aria-label={config.backLabel}
          size="bare"
          variant="outline"
          className="flex h-9 w-9 items-center justify-center rounded-full text-rose-dark hover:bg-rose-lightest"
        >
          <FaArrowLeft className="h-5 w-5" />
        </ButtonElement>
        <h1 className="flex items-center gap-3 font-display text-3xl text-neutral-dark md:text-4xl">
          <span aria-hidden>🪪</span> Health Passport
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
            <h2 className={`${sectionHeading} mb-5`}>
              <span aria-hidden>🐹</span> Identity Card
            </h2>
            <div className="flex flex-col gap-5 rounded-xl border-2 border-gold bg-gold-lightest p-5 sm:flex-row sm:items-start">
              {data.pet.petPhoto ? (
                <img
                  src={data.pet.petPhoto}
                  alt={`${data.pet.petName} photo`}
                  className="h-20 w-20 shrink-0 rounded-full bg-gold object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gold ring-2 ring-teal-dark">
                  <FaPaw className="h-7 w-7 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/50 pb-4">
                  <div className="min-w-0">
                    <p className="font-body text-lg font-medium text-neutral-charcoal">
                      {data.pet.petName}
                    </p>
                    <p className="font-body text-sm text-neutral-charcoal">
                      {[
                        data.pet.breed.breedName,
                        data.pet.breed.speciesName,
                        data.pet.petAge,
                        data.pet.petSex,
                      ].join(" · ")}
                    </p>
                  </div>
                  <Badge
                    tone={PET_STATUS_META[data.pet.adoptionStatus].tone}
                    className="shrink-0"
                  >
                    {PET_STATUS_META[data.pet.adoptionStatus].label}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
                  <Fact k="Blood Group" v={data.pet.petBGroup || "—"} />
                  <Fact k="Microchip" v={data.pet.microchipID || "—"} />
                  <Fact k="Size" v={data.pet.petSize ?? "—"} />
                  <Fact k="Color" v={data.pet.petColor} />
                  <Fact k="Shelter" v={data.pet.shelter.shelterName} />
                  <Fact k="Pet ID" v={data.pet.petCode} />
                  <Fact k="Height" v={`${data.pet.petHeight} cm`} />
                  <Fact k="Weight" v={`${data.pet.petWeight} kg`} />
                </dl>
              </div>
            </div>
          </Card>

          {/* Health Records */}
          <Card className="p-6">
            <h2 className={sectionHeading}>
              <span aria-hidden>📁</span> Health Records
            </h2>
            <div className="mb-5 mt-3 flex flex-wrap justify-end gap-2">
              <ButtonElement
                disabled
                title="AI summaries aren't available yet"
                size="sm"
                className="flex cursor-not-allowed items-center gap-1.5 bg-rose-md"
              >
                <PiSparkleFill aria-hidden /> Summarize with AI
              </ButtonElement>
              {role === "Veterinarian" && (
                <ButtonElement
                  onClick={() => setIsAddRecordOpen(true)}
                  size="sm"
                  className="flex items-center gap-1.5 bg-teal-dark hover:brightness-95"
                >
                  <FaPlus aria-hidden /> Add Record
                </ButtonElement>
              )}
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
                    className="flex flex-col gap-3 rounded-xl bg-teal-light p-5 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <DateBlock iso={record.createdAt} />
                    <div className="min-w-0 flex-1">
                      <RecordDesc text={record.recordDesc} />
                      {record.appointmentCode && (
                        <p className="mt-1 font-body text-xs text-neutral-gray">
                          From appointment {record.appointmentCode}
                        </p>
                      )}
                    </div>
                    {(record.vetName || record.shelterName) && (
                      <p className="shrink-0 self-start font-body text-xs text-neutral-gray sm:text-right">
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
            <h2 className={`${sectionHeading} mb-5`}>
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
                    className="flex items-start justify-between gap-4 rounded-xl bg-rose-lightest p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm font-bold text-neutral-charcoal">
                        {vax.vaccineName}
                      </p>
                      <dl className="mt-1.5 grid grid-cols-[7.5rem_auto] gap-x-4 font-body text-xs text-neutral-charcoal">
                        <dt>Administered:</dt>
                        <dd className="text-right">
                          {formatShortDate(new Date(vax.administeredDate))}
                        </dd>
                        <dt>Due Date:</dt>
                        <dd className="text-right">
                          {formatNextDue(vax.dueDate)}
                        </dd>
                      </dl>
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
            <h2 className={`${sectionHeading} mb-5`}>
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
                    className="flex flex-col gap-3 rounded-xl bg-teal-light p-5 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <DateBlock iso={transfer.transferDate} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-bold text-neutral-charcoal">
                        {transfer.fromShelterName} → {transfer.toShelterName}
                      </p>
                      <p className="mt-2 font-body text-sm text-neutral-charcoal">
                        Notes: {transfer.transferReason}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 self-start sm:items-end">
                      {(transfer.fromStaffName || transfer.toStaffName) && (
                        <p className="font-body text-xs text-neutral-gray">
                          Staff: {transfer.fromStaffName ?? "—"} →{" "}
                          {transfer.toStaffName ?? "—"}
                        </p>
                      )}
                      <Badge tone={TRANSFER_STATUS_TONE[transfer.transferStatus]}>
                        {TRANSFER_STATUS_LABEL[transfer.transferStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {data && role === "Veterinarian" && (
        <AddHealthRecordModal
          isOpen={isAddRecordOpen}
          onClose={() => setIsAddRecordOpen(false)}
          petID={petID}
          petName={data.pet.petName}
          passportQueryKey={passportQueryKey}
        />
      )}
    </div>
  );
};

export default HealthPassport;
