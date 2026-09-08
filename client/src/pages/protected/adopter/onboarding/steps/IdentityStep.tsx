// IdentityStep.tsx — onboarding Step 3
// Reuses GovernmentIdSection as-is (self-managed query/mutation) — this
// step just adds the header + a Continue button gated on a submission
// existing at all (any verificationStatus, not necessarily Verified;
// manual review can take time and isn't a wizard blocker).
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { PiIdentificationCardBold } from "react-icons/pi";
import GovernmentIdSection from "../../sections/GovernmentIdSection";
import { getGovernmentId } from "../../../../../logic/api/adoptersApi";
import OnboardingStepHeader from "../OnboardingStepHeader";

interface IdentityStepProps {
  onContinue: () => void;
}

const IdentityStep = ({ onContinue }: IdentityStepProps) => {
  const query = useQuery({
    queryKey: ["adopter", "government-id"],
    queryFn: getGovernmentId,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  const hasSubmission = query.isSuccess;

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiIdentificationCardBold />}
        title="Verify Your Identity"
        description="Shelters require a government ID on file before approving an adoption."
      />

      <GovernmentIdSection isEditing />

      <button
        type="button"
        onClick={onContinue}
        disabled={!hasSubmission}
        className="mt-6 w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
};

export default IdentityStep;
