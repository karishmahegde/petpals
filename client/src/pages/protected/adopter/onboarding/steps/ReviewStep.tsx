// ReviewStep.tsx — onboarding Step 7
// Read-only summary of Steps 2-6 + government ID status. Each section links
// back to its step for in-place editing (?from=review — see
// OnboardingWizard.tsx for how that routes the post-save navigation back
// here instead of forward through the remaining steps).
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PiClipboardTextBold } from "react-icons/pi";
import OnboardingStepHeader from "../OnboardingStepHeader";
import {
  completeOnboarding,
  getGovernmentId,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";
import useAuthStore from "../../../../../logic/store/useAuthStore";

interface ReviewStepProps {
  profile: AdopterProfileData;
  onBack?: () => void;
}

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const humanize = (value: string) => value.replace(/_/g, " ");

const ReviewStep = ({ profile, onBack }: ReviewStepProps) => {
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);

  const governmentIdQuery = useQuery({
    queryKey: ["adopter", "government-id"],
    queryFn: getGovernmentId,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const mutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (adopter) => {
      updateUser({
        onboardingComplete: true,
        onboardingStep: adopter.onboardingStep,
      });
      navigate("/adopter", { replace: true });
    },
  });

  const address = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state,
    profile.zip,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");

  const sections: { title: string; step: number; rows: [string, string][] }[] = [
    {
      title: "Personal",
      step: 2,
      rows: [
        [
          "Date of birth",
          profile.adopterDOB ? profile.adopterDOB.slice(0, 10) : "—",
        ],
        ["Sex", profile.adopterSex ?? "—"],
        ["Phone", profile.adopterPhone ?? "—"],
        ["Address", address || "—"],
      ],
    },
    {
      title: "Identity",
      step: 3,
      rows: [
        [
          "Government ID",
          governmentIdQuery.isSuccess
            ? `${governmentIdQuery.data.idType} (${governmentIdQuery.data.verificationStatus})`
            : "Not submitted",
        ],
      ],
    },
    {
      title: "Household",
      step: 4,
      rows: [
        ["Housing type", profile.housingType ?? "—"],
        ["Owns or rents", profile.ownsOrRents ?? "—"],
        ["Landlord contact", profile.landlordContact ?? "—"],
        ["Household size", String(profile.householdSize ?? "—")],
        ["Number of children", String(profile.numChildren ?? "—")],
      ],
    },
    {
      title: "Lifestyle",
      step: 5,
      rows: [
        [
          "Employment status",
          profile.employmentStatus ? humanize(profile.employmentStatus) : "—",
        ],
        ["Activity level", profile.activityLevel ?? "—"],
        ["Yard available", profile.yardAvailable ? "Yes" : "No"],
        ["Pet experience", profile.petExperience ?? "—"],
        ["Current pets", String(profile.currentPets)],
      ],
    },
    {
      title: "Preferences",
      step: 6,
      rows: [
        ["Preferred age range", profile.preferredAgeRange ?? "No preference"],
        ["Preferred size", profile.preferredSize ?? "No preference"],
        ["Open to special needs", profile.openToSpecialNeeds ? "Yes" : "No"],
      ],
    },
  ];

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiClipboardTextBold />}
        title="Review"
        description="Double check everything below, then submit to finish onboarding."
      />

      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-rose-light p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-body text-sm font-bold text-neutral-dark">
                {section.title}
              </h3>
              <button
                type="button"
                onClick={() =>
                  navigate(`/onboarding/step/${section.step}?from=review`)
                }
                className="font-body text-xs font-medium text-teal-dark underline"
              >
                Edit
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {section.rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="font-body text-xs text-neutral-gray">
                    {label}
                  </dt>
                  <dd className="font-body text-sm text-neutral-dark">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {mutation.isError && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {extractError(mutation.error)}
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
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex-1 rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
