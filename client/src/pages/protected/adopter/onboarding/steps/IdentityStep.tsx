// IdentityStep.tsx — onboarding Step 3
// Reuses GovernmentIdSection as-is (self-managed query/mutation) — this
// step just adds the header + a Continue button gated on a submission
// existing at all (any verificationStatus, not necessarily Verified;
// manual review can take time and isn't a wizard blocker).
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { PiIdentificationCardBold } from "react-icons/pi";
import GovernmentIdSection from "../../shared/GovernmentIdSection";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import { getGovernmentId } from "../../../../../logic/api/adoptersApi";
import OnboardingStepHeader from "../OnboardingStepHeader";

interface IdentityStepProps {
  onContinue: () => void;
  onBack?: () => void;
}

const IdentityStep = ({ onContinue, onBack }: IdentityStepProps) => {
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

      <div className="mt-6 flex gap-3">
        {onBack && (
          <ButtonElement
            onClick={onBack}
            size="panel"
            className="flex-1 bg-gold hover:brightness-90 disabled:cursor-not-allowed"
          >
            Back
          </ButtonElement>
        )}
        <ButtonElement
          onClick={onContinue}
          disabled={!hasSubmission}
          size="panel"
          className="flex-1 bg-teal-dark hover:brightness-90 disabled:cursor-not-allowed"
        >
          Continue
        </ButtonElement>
      </div>
    </div>
  );
};

export default IdentityStep;
