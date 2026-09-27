// PersonalStep.tsx - onboarding Step 2
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { PiUserBold } from "react-icons/pi";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import PersonalFields, {
  type PersonalValues,
} from "../../../../../components/ui/onboarding/PersonalFields";
import AddressFields from "../../../../../components/ui/onboarding/AddressFields";
import {
  updateAdopterProfile,
  type AdopterProfile as AdopterProfileData,
} from "../../../../../logic/api/adoptersApi";
import {
  isAddressComplete,
  isValidZipForCountry,
  toAddressPayload,
  type Address,
} from "../../../../../logic/utils/address";

interface PersonalStepProps {
  profile: AdopterProfileData;
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
    dob: profile.adopterDOB ? profile.adopterDOB.slice(0, 10) : "",
    sex: profile.adopterSex ?? "",
    phone: profile.adopterPhone ?? undefined,
  });
  const [address, setAddress] = useState<Address>({
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    zip: profile.zip ?? "",
    country: profile.country ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateAdopterProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (
      !personal.dob ||
      !personal.sex ||
      !personal.phone ||
      !isAddressComplete(address)
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!isValidZipForCountry(address.zip, address.country)) {
      setError(
        "Please enter a valid ZIP/postal code for the selected country.",
      );
      return;
    }
    setError(null);
    mutation.mutate({
      avatarSeed: personal.avatarSeed,
      adopterDOB: personal.dob,
      adopterSex: personal.sex,
      adopterPhone: personal.phone,
      ...toAddressPayload(address),
    });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiUserBold />}
        title="About You"
        description="A few basics so shelters know who they're talking to."
      />

      <PersonalFields
        value={personal}
        onChange={(patch) => setPersonal((prev) => ({ ...prev, ...patch }))}
      />

      <div className="mt-6">
        <AddressFields
          value={address}
          onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))}
        />
      </div>

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
