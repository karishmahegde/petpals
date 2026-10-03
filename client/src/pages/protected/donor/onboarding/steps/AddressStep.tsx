// AddressStep.tsx — donor onboarding Step 3
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { PiHouseLineBold } from "react-icons/pi";
import OnboardingStepHeader from "../../../../../components/ui/onboarding/OnboardingStepHeader";
import OnboardingStepNav from "../../../../../components/ui/onboarding/OnboardingStepNav";
import AddressFields from "../../../../../components/ui/onboarding/AddressFields";
import {
  updateMyDonorProfile,
  type DonorSelfProfile,
} from "../../../../../logic/api/donorsApi";
import {
  isAddressComplete,
  isValidZipForCountry,
  toAddressPayload,
  type Address,
} from "../../../../../logic/utils/address";

interface AddressStepProps {
  profile: DonorSelfProfile;
  onContinue: () => void;
  onBack?: () => void;
}

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AddressStep = ({ profile, onContinue, onBack }: AddressStepProps) => {
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
    mutationFn: updateMyDonorProfile,
    onSuccess: () => onContinue(),
    onError: (err) => setError(extractError(err)),
  });

  const handleContinue = () => {
    if (!isAddressComplete(address)) {
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
    mutation.mutate({ ...toAddressPayload(address) });
  };

  return (
    <div>
      <OnboardingStepHeader
        icon={<PiHouseLineBold />}
        title="Your Address"
        description="Where you live — kept on your donor record, never shown publicly."
      />

      <AddressFields
        value={address}
        onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))}
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

export default AddressStep;
