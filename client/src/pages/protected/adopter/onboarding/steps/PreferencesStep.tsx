// PreferencesStep.tsx — onboarding Step 6
// All fields here are soft preferences, not required data — Continue is
// always enabled, unlike every other data-collecting step.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PiSlidersHorizontalBold } from "react-icons/pi";
import SegmentedControl from "../../../../../components/ui/SegmentedControl";
import OnboardingStepHeader from "../OnboardingStepHeader";
import {
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";
import { getSpecies, getBreeds, type Breed } from "../../../../../logic/api/petsApi";

interface PreferencesStepProps {
  profile: AdopterProfileData;
  onContinue: () => void;
  onBack?: () => void;
}

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

const AGE_RANGE_OPTIONS = [
  { value: "Young", label: "Young" },
  { value: "Adult", label: "Adult" },
  { value: "Old", label: "Old" },
];
const SIZE_OPTIONS = [
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
];
const SPECIAL_NEEDS_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const PreferencesStep = ({ profile, onContinue, onBack }: PreferencesStepProps) => {
  const speciesQuery = useQuery({ queryKey: ["species"], queryFn: getSpecies });
  const speciesIDs = (speciesQuery.data ?? []).map((s) => s.speciesID);
  const breedsQuery = useQuery({
    queryKey: ["breeds", speciesIDs],
    queryFn: () => getBreeds(speciesIDs),
    enabled: speciesIDs.length > 0,
  });
  const breeds = breedsQuery.data ?? [];
  const breedsBySpecies = breeds.reduce<Record<string, Breed[]>>(
    (acc, breed) => {
      (acc[breed.speciesName] ??= []).push(breed);
      return acc;
    },
    {},
  );

  const [preferredBreedID, setPreferredBreedID] = useState<number | null>(
    profile.preferredBreedID,
  );
  const [preferredAgeRange, setPreferredAgeRange] = useState(
    profile.preferredAgeRange ?? "",
  );
  const [preferredSize, setPreferredSize] = useState(profile.preferredSize ?? "");
  const [openToSpecialNeeds, setOpenToSpecialNeeds] = useState(
    profile.openToSpecialNeeds ? "yes" : "no",
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateAdopterProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    setError(null);
    mutation.mutate({
      preferredBreedID,
      preferredAgeRange: preferredAgeRange || null,
      preferredSize: preferredSize || null,
      openToSpecialNeeds: openToSpecialNeeds === "yes",
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiSlidersHorizontalBold />}
        title="Adoption Preferences"
        description="Optional — helps us surface pets that fit what you're looking for. You can always change these later."
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Preferred breed
          </label>
          <select
            value={preferredBreedID == null ? "" : String(preferredBreedID)}
            onChange={(e) =>
              setPreferredBreedID(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className={inputClass}
          >
            <option value="">— No preference —</option>
            {Object.entries(breedsBySpecies).map(([species, list]) => (
              <optgroup key={species} label={species}>
                {list.map((b) => (
                  <option key={b.breedID} value={b.breedID}>
                    {b.breedName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Preferred age range
          </label>
          <SegmentedControl
            options={AGE_RANGE_OPTIONS}
            value={preferredAgeRange || null}
            onChange={setPreferredAgeRange}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Preferred size
          </label>
          <SegmentedControl
            options={SIZE_OPTIONS}
            value={preferredSize || null}
            onChange={setPreferredSize}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Open to special needs pets
          </label>
          <SegmentedControl
            options={SPECIAL_NEEDS_OPTIONS}
            value={openToSpecialNeeds}
            onChange={setOpenToSpecialNeeds}
            className="w-auto sm:w-56"
          />
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

export default PreferencesStep;
