// IdentityStep.tsx — volunteer onboarding Step 4
// Reuses the shared GovernmentIdSection (self-managed query/mutation) with
// the volunteer's /volunteers/me/government-id calls — this step adds the
// header and a Continue gated on a submission existing at all. Verifying it
// isn't a wizard blocker: that's the shelter staff's job, and it must be
// Verified before they can approve this account.
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { PiIdentificationCardBold } from "react-icons/pi";
import GovernmentIdSection from "../../../shared/GovernmentIdSection";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import { volunteerGovernmentIdApi } from "../../../../../logic/api/volunteersApi";

interface IdentityStepProps {
  onContinue: () => void;
  onBack?: () => void;
}

const IdentityStep = ({ onContinue, onBack }: IdentityStepProps) => {
  const query = useQuery({
    queryKey: volunteerGovernmentIdApi.queryKey,
    queryFn: volunteerGovernmentIdApi.get,
    retry: (failureCount, err) =>
      axios.isAxiosError(err) && err.response?.status === 404
        ? false
        : failureCount < 2,
  });

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiIdentificationCardBold />}
        title="Verify Your Identity"
        description="Your shelter verifies this ID before your account is approved."
      />

      <GovernmentIdSection api={volunteerGovernmentIdApi} isEditing />

      <OnboardingStepNav
        onBack={onBack}
        onContinue={onContinue}
        disabled={!query.isSuccess}
      />
    </div>
  );
};

export default IdentityStep;
