// ReviewStep.tsx — donor onboarding Step 4
// Read-only summary of Steps 2-3. Each section links back to its step for
// editing (?from=review — see DonorOnboardingWizard.tsx). Submit completes
// onboarding and lands on the donor dashboard.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PiClipboardTextBold } from "react-icons/pi";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import PhoneDisplay from "../../../../../components/ui/PhoneDisplay";
import {
  completeMyDonorOnboarding,
  type DonorSelfProfile,
} from "../../../../../logic/api/donorsApi";
import { formatAddress } from "../../../../../logic/utils/address";
import useAuthStore from "../../../../../logic/store/useAuthStore";

interface ReviewStepProps {
  profile: DonorSelfProfile;
  onBack?: () => void;
}

const SEX_LABELS: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const ReviewStep = ({ profile, onBack }: ReviewStepProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  const mutation = useMutation({
    mutationFn: completeMyDonorOnboarding,
    onSuccess: (donor) => {
      updateUser({ onboardingComplete: true, onboardingStep: donor.onboardingStep });
      queryClient.invalidateQueries({ queryKey: ["donor", "me"] });
      navigate("/donor", { replace: true });
    },
  });

  const sections: { title: string; step: number; rows: [string, React.ReactNode][] }[] = [
    {
      title: "Personal",
      step: 2,
      rows: [
        ["Date of birth", profile.donorDOB ? profile.donorDOB.slice(0, 10) : "—"],
        ["Sex", profile.donorSex ? (SEX_LABELS[profile.donorSex] ?? profile.donorSex) : "—"],
        ["Phone", profile.donorPhone ? <PhoneDisplay value={profile.donorPhone} /> : "—"],
      ],
    },
    {
      title: "Address",
      step: 3,
      rows: [["Address", formatAddress(profile) || "—"]],
    },
  ];

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiClipboardTextBold />}
        title="Review"
        description="Double check everything below, then finish setting up your account."
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
              <ButtonElement
                onClick={() => navigate(`/donor/onboarding/step/${section.step}?from=review`)}
                size="bare"
                variant="outline"
                className="text-xs font-medium text-teal-dark underline"
              >
                Edit
              </ButtonElement>
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

      <OnboardingStepNav
        onBack={onBack}
        onContinue={() => mutation.mutate()}
        continueLabel="Finish"
        pendingLabel="Finishing…"
        isPending={mutation.isPending}
      />
    </div>
  );
};

export default ReviewStep;
