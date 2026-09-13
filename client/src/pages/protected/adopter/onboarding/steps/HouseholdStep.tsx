// HouseholdStep.tsx — onboarding Step 4
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { PiHouseBold } from "react-icons/pi";
import SegmentedControl from "../../../../../components/ui/SegmentedControl";
import OnboardingStepHeader from "../OnboardingStepHeader";
import {
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";

interface HouseholdStepProps {
  profile: AdopterProfileData;
  onContinue: () => void;
  onBack?: () => void;
}

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

const HOUSING_OPTIONS = [
  { value: "Apartment", label: "Apartment", icon: "🏢" },
  { value: "House", label: "House", icon: "🏠" },
  { value: "Other", label: "Other", icon: "🔑" },
];

const OWNS_RENTS_OPTIONS = [
  { value: "Owns", label: "Own" },
  { value: "Rents", label: "Rent" },
];

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const HouseholdStep = ({ profile, onContinue, onBack }: HouseholdStepProps) => {
  const [housingType, setHousingType] = useState(profile.housingType ?? "");
  const [ownsOrRents, setOwnsOrRents] = useState(profile.ownsOrRents ?? "");
  // The mockup shows separate Name/Phone landlord fields, but the schema has
  // one VARCHAR(20) landlordContact column (per the spec's field-mapping
  // table) — collected as a single free-text field to match what's storable.
  const [landlordContact, setLandlordContact] = useState(
    profile.landlordContact ?? "",
  );
  const [householdSize, setHouseholdSize] = useState(
    profile.householdSize ?? 1,
  );
  const [numChildren, setNumChildren] = useState(profile.numChildren ?? 0);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateAdopterProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (!housingType || !ownsOrRents) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    mutation.mutate({
      housingType,
      ownsOrRents,
      landlordContact: landlordContact.trim() || null,
      householdSize,
      numChildren,
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiHouseBold />}
        title="About your Home"
        description="This helps us match you with pets that will thrive in your living situation."
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Housing Type
          </label>
          <SegmentedControl
            options={HOUSING_OPTIONS}
            value={housingType || null}
            onChange={setHousingType}
          />
        </div>

        <div className="rounded-xl border border-rose-light p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-body text-sm font-bold text-neutral-dark">
                Do you own or rent?
              </p>
              <p className="font-body text-xs text-neutral-gray">
                Renters may need landlord approval for pets.
              </p>
            </div>
            <SegmentedControl
              options={OWNS_RENTS_OPTIONS}
              value={ownsOrRents || null}
              onChange={setOwnsOrRents}
              className="w-auto sm:w-56"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Landlord Contact{" "}
            <span className="font-normal text-neutral-gray">(optional)</span>
          </label>
          <input
            type="text"
            value={landlordContact}
            onChange={(e) => setLandlordContact(e.target.value)}
            maxLength={20}
            placeholder="Name or phone"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">
              Household size
            </label>
            <input
              type="number"
              min={0}
              value={householdSize}
              onChange={(e) =>
                setHouseholdSize(Math.max(0, Math.trunc(Number(e.target.value)) || 0))
              }
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-xs text-neutral-gray">
              Number of children
            </label>
            <input
              type="number"
              min={0}
              value={numChildren}
              onChange={(e) =>
                setNumChildren(Math.max(0, Math.trunc(Number(e.target.value)) || 0))
              }
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-xl bg-gold py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleContinue}
          disabled={mutation.isPending}
          className="flex-1 rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
};

export default HouseholdStep;
