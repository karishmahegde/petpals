// PersonalStep.tsx — donor onboarding Step 2
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { PiUserBold } from "react-icons/pi";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import PersonalFields, {
  type PersonalValues,
} from "../../../../../components/ui/onboarding/PersonalFields";
import {
  updateMyDonorProfile,
  type DonorSelfProfile,
} from "../../../../../logic/api/donorsApi";

interface PersonalStepProps {
  profile: DonorSelfProfile;
  onContinue: () => void;
  onBack?: () => void;
}

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const PersonalStep = ({ profile, onContinue, onBack }: PersonalStepProps) => {
  const [personal, setPersonal] = useState<PersonalValues>({
    avatarSeed: profile.avatarSeed,
    dob: profile.donorDOB ? profile.donorDOB.slice(0, 10) : "",
    sex: profile.donorSex ?? "",
    phone: profile.donorPhone ?? undefined,
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMyDonorProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (!personal.dob || !personal.sex || !personal.phone) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    mutation.mutate({
      avatarSeed: personal.avatarSeed,
      donorDOB: personal.dob,
      donorSex: personal.sex,
      donorPhone: personal.phone,
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiUserBold />}
        title="About You"
        description="A few basics so shelters know who's supporting them."
      />

      <PersonalFields
        value={personal}
        onChange={(patch) => setPersonal((prev) => ({ ...prev, ...patch }))}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <OnboardingStepNav
        onBack={onBack}
        onContinue={handleContinue}
        isPending={mutation.isPending}
      />
    </div>
  );
};

export default PersonalStep;
