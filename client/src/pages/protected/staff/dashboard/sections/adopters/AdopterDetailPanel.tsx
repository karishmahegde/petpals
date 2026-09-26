// AdopterDetailPanel.tsx
// Read-only "Adopter Details" slide-over — opened from an Adopters row's
// "View Details", or deep-linked via ?adopterID= (e.g. from an adopted
// pet's panel). Fetches the full profile (GET /adopters/:id) since the list
// row only carries a summary. Same identity banner + InfoRow layout as the
// Staff/Vets detail panels; no footer — there's nothing to change here.
import { useQuery } from "@tanstack/react-query";
import SlideOver from "../../../../../../components/ui/SlideOver";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import {
  formatFullDate,
  formatTime,
} from "../../../../../../logic/utils/datetime";
import { getAdopterDetail } from "../../../../../../logic/api/staffAdoptersApi";
import { ADOPTER_STATUS_TONE } from "../../../../../../logic/staff/adopterStatus";
import { formatAddress } from "../../../../../../logic/utils/address";

interface AdopterDetailPanelProps {
  adopterID: number | null;
  onClose: () => void;
}

const GOVERNMENT_ID_TONE: Record<
  "Pending" | "Verified" | "Rejected",
  BadgeTone
> = {
  Pending: "gold",
  Verified: "green",
  Rejected: "red",
};

const SEX_LABEL: Record<"M" | "F", string> = { M: "Male", F: "Female" };

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading = "font-body text-sm font-semibold text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

// DB enum values like "Self_employed" → "Self employed" (same as the
// onboarding ReviewStep).
const humanize = (v: string | null) => (v ? v.replace(/_/g, " ") : "—");
const yesNo = (v: boolean) => (v ? "Yes" : "No");
const orDash = (v: string | number | null) =>
  v === null || v === "" ? "—" : String(v);

const AdopterDetailPanel = ({
  adopterID,
  onClose,
}: AdopterDetailPanelProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "adopter", adopterID],
    queryFn: () => getAdopterDetail(adopterID!),
    enabled: adopterID !== null,
  });

  const address = data ? formatAddress(data) : "";

  return (
    <SlideOver
      open={adopterID !== null}
      onClose={onClose}
      title="Adopter Details"
    >
      {isLoading && (
        <p className="p-8 text-center text-sm text-neutral-gray">
          Loading adopter…
        </p>
      )}
      {isError && (
        <p className="p-8 text-center text-sm text-rose-dark">
          Couldn't load this adopter. Please try again.
        </p>
      )}

      {data && (
        <div className="p-6">
          {/* Identity summary */}
          <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
            <Avatar
              seed={data.avatarSeed}
              alt={`${data.adopterName} avatar`}
              size={56}
              className="h-14 w-14 shrink-0 rounded-full ring-2 ring-teal-dark"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-body font-bold text-neutral-charcoal">
                {data.adopterName}
              </p>
              <p className="truncate text-xs text-neutral-gray">
                Member since {formatFullDate(new Date(data.createdAt))}
              </p>
            </div>
            <Badge tone={ADOPTER_STATUS_TONE[data.accountStatus]}>
              {data.accountStatus}
            </Badge>
          </div>
          {(data.preQualifyFlag || data.adopterRiskFlag) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.preQualifyFlag && <Badge tone="green">Pre Approved</Badge>}
              {data.adopterRiskFlag && <Badge tone="red">Risk Flagged</Badge>}
            </div>
          )}

          {/* Contact */}
          <dl className="mt-5 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Email" v={data.adopterEmail} />
            <InfoRow
              k="Phone"
              v={
                data.adopterPhone ? (
                  <PhoneDisplay value={data.adopterPhone} />
                ) : (
                  "—"
                )
              }
            />
            <InfoRow k="Address" v={address || "—"} />
            <InfoRow
              k="Date of Birth"
              v={
                data.adopterDOB
                  ? formatFullDate(new Date(data.adopterDOB))
                  : "—"
              }
            />
            <InfoRow
              k="Sex"
              v={data.adopterSex ? SEX_LABEL[data.adopterSex] : "—"}
            />
            <dt className={label}>Government ID</dt>
            <dd>
              {data.governmentIdStatus ? (
                <Badge tone={GOVERNMENT_ID_TONE[data.governmentIdStatus]}>
                  {data.governmentIdStatus}
                </Badge>
              ) : (
                <Badge tone="gray">Not Submitted</Badge>
              )}
            </dd>
          </dl>

          {/* Household */}
          <div className={divider} />
          <h3 className={sectionHeading}>Household</h3>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Housing Type" v={orDash(data.housingType)} />
            <InfoRow k="Owns or Rents" v={orDash(data.ownsOrRents)} />
            <InfoRow k="Landlord Contact" v={orDash(data.landlordContact)} />
            <InfoRow k="Household Size" v={orDash(data.householdSize)} />
            <InfoRow k="No. of Children" v={orDash(data.numChildren)} />
            <InfoRow k="Yard" v={yesNo(data.yardAvailable)} />
            <InfoRow k="Current Pets" v={data.currentPets} />
          </dl>

          {/* Lifestyle */}
          <div className={divider} />
          <h3 className={sectionHeading}>Lifestyle</h3>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Employment" v={humanize(data.employmentStatus)} />
            <InfoRow k="Activity Level" v={humanize(data.activityLevel)} />
            <InfoRow k="Pet Experience" v={humanize(data.petExperience)} />
          </dl>

          {/* Preferences */}
          <div className={divider} />
          <h3 className={sectionHeading}>Pet Preferences</h3>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Breed" v={data.preferredBreedName ?? "No preference"} />
            <InfoRow
              k="Age Range"
              v={data.preferredAgeRange ?? "No preference"}
            />
            <InfoRow k="Size" v={data.preferredSize ?? "No preference"} />
            <InfoRow
              k="Special Needs"
              v={data.openToSpecialNeeds ? "Open to it" : "No"}
            />
          </dl>

          {/* Account */}
          <div className={divider} />
          <h3 className={sectionHeading}>Account</h3>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Email Verified" v={yesNo(data.emailVerified)} />
            <InfoRow
              k="Onboarding"
              v={data.onboardingComplete ? "Complete" : "Incomplete"}
            />
            <InfoRow
              k="Last Login"
              v={
                data.lastLoginAt
                  ? `${formatFullDate(new Date(data.lastLoginAt))}, ${formatTime(new Date(data.lastLoginAt))}`
                  : "—"
              }
            />
          </dl>
        </div>
      )}
    </SlideOver>
  );
};

export default AdopterDetailPanel;
