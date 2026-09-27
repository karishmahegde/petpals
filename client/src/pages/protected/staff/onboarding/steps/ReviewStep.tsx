// ReviewStep.tsx — staff onboarding Step 5
// Read-only summary of Steps 2-4. Each section links back to its step for
// editing (?from=review — see StaffOnboardingWizard.tsx). Submit completes
// onboarding; a still-Pending account then waits on the "awaiting approval"
// screen (OnboardingGate routes it there).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PiClipboardTextBold } from "react-icons/pi";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import PhoneDisplay from "../../../../../components/ui/PhoneDisplay";
import {
  completeMyStaffOnboarding,
  getMyStaffGovernmentId,
  type StaffSelfProfile,
} from "../../../../../logic/api/staffApi";
import { formatAddress } from "../../../../../logic/utils/address";
import useAuthStore from "../../../../../logic/store/useAuthStore";

interface ReviewStepProps {
  profile: StaffSelfProfile;
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

  const governmentIdQuery = useQuery({
    queryKey: ["staff", "government-id"],
    queryFn: getMyStaffGovernmentId,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const mutation = useMutation({
    mutationFn: completeMyStaffOnboarding,
    onSuccess: (staff) => {
      updateUser({
        onboardingComplete: true,
        onboardingStep: staff.onboardingStep,
        accountStatus: staff.accountStatus ?? undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["staff", "me"] });
      navigate(staff.accountStatus === "Pending" ? "/staff/pending" : "/staff", {
        replace: true,
      });
    },
  });

  const sections: { title: string; step: number; rows: [string, React.ReactNode][] }[] = [
    {
      title: "Personal",
      step: 2,
      rows: [
        ["Date of birth", profile.staffDOB ? profile.staffDOB.slice(0, 10) : "—"],
        ["Sex", profile.staffSex ? (SEX_LABELS[profile.staffSex] ?? profile.staffSex) : "—"],
        ["Phone", profile.staffPhone ? <PhoneDisplay value={profile.staffPhone} /> : "—"],
      ],
    },
    {
      title: "Address",
      step: 3,
      rows: [["Address", formatAddress(profile) || "—"]],
    },
    {
      title: "Identity",
      step: 4,
      rows: [
        [
          "Government ID",
          governmentIdQuery.isSuccess
            ? `${governmentIdQuery.data.idType} (${governmentIdQuery.data.verificationStatus})`
            : "Not submitted",
        ],
      ],
    },
  ];

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiClipboardTextBold />}
        title="Review"
        description="Double check everything below, then submit it for approval."
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
                onClick={() =>
                  navigate(`/staff/onboarding/step/${section.step}?from=review`)
                }
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
        continueLabel="Submit for approval"
        pendingLabel="Submitting…"
        isPending={mutation.isPending}
      />
    </div>
  );
};

export default ReviewStep;
