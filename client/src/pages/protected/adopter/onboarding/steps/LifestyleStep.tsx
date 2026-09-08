// LifestyleStep.tsx — onboarding Step 5
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { PiHeartbeatBold } from "react-icons/pi";
import SegmentedControl from "../../../../../components/ui/SegmentedControl";
import OnboardingStepHeader from "../OnboardingStepHeader";
import {
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";

interface LifestyleStepProps {
  profile: AdopterProfileData;
  onContinue: () => void;
}

const inputClass =
  "w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";

const EMPLOYMENT_OPTIONS = [
  "Unemployed",
  "Student",
  "Self_employed",
  "Employed",
];
const ACTIVITY_OPTIONS = [
  { value: "Sedentary", label: "Sedentary" },
  { value: "Medium", label: "Medium" },
  { value: "Active", label: "Active" },
];
const YARD_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const EXPERIENCE_OPTIONS = [
  { value: "No", label: "None" },
  { value: "Little", label: "Little" },
  { value: "Some", label: "Some" },
  { value: "Very", label: "Very" },
];

const humanize = (value: string) => value.replace(/_/g, " ");

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const LifestyleStep = ({ profile, onContinue }: LifestyleStepProps) => {
  const [employmentStatus, setEmploymentStatus] = useState(
    profile.employmentStatus ?? "",
  );
  const [activityLevel, setActivityLevel] = useState(
    profile.activityLevel ?? "",
  );
  const [yardAvailable, setYardAvailable] = useState(
    profile.yardAvailable ? "yes" : "no",
  );
  const [petExperience, setPetExperience] = useState(
    profile.petExperience ?? "",
  );
  const [currentPets, setCurrentPets] = useState(profile.currentPets ?? 0);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateAdopterProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (!employmentStatus || !activityLevel || !petExperience) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    mutation.mutate({
      employmentStatus,
      activityLevel,
      yardAvailable: yardAvailable === "yes",
      petExperience,
      currentPets,
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiHeartbeatBold />}
        title="Your Lifestyle"
        description="Tell us about your day-to-day so we can match pets to your pace of life."
      />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Employment status
          </label>
          <select
            value={employmentStatus}
            onChange={(e) => setEmploymentStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {EMPLOYMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {humanize(opt)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Activity level
          </label>
          <SegmentedControl
            options={ACTIVITY_OPTIONS}
            value={activityLevel || null}
            onChange={setActivityLevel}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Yard available
          </label>
          <SegmentedControl
            options={YARD_OPTIONS}
            value={yardAvailable}
            onChange={setYardAvailable}
            className="w-auto sm:w-56"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-body text-sm font-bold text-neutral-dark">
            Pet experience
          </label>
          <SegmentedControl
            options={EXPERIENCE_OPTIONS}
            value={petExperience || null}
            onChange={setPetExperience}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-xs text-neutral-gray">
            Current pets owned
          </label>
          <input
            type="number"
            min={0}
            value={currentPets}
            onChange={(e) =>
              setCurrentPets(Math.max(0, Math.trunc(Number(e.target.value)) || 0))
            }
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={mutation.isPending}
        className="mt-6 w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
};

export default LifestyleStep;
