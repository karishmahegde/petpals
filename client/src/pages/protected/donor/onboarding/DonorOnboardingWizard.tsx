// DonorOnboardingWizard.tsx
// Route element for /donor/onboarding/step/:step (ProtectedRoute +
// RoleRoute(["Donor"]) in App.tsx). Donors are Active from sign-up, so —
// like the adopter wizard and unlike staff/vets/volunteers — this one is
// skippable: "Skip for now" lets them into the dashboard (and donate) for
// this browser session (see OnboardingGate.tsx). Steps: 2 Personal,
// 3 Address, 4 Review (Step 1, Account, is registration itself; donors
// submit no government ID).
// Owns the profile fetch and the step-clamping, and hands each step the
// profile plus an onContinue that advances onboardingStep — to the next
// step, or back to Review when the step was opened from Review's Edit link
// (?from=review).
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "../../../../components/layout/Navbar";
import Card from "../../../../components/ui/Card";
import OnboardingProgress, {
  type OnboardingStepDef,
} from "../../../../components/ui/onboarding/OnboardingProgress";
import PersonalStep from "./steps/PersonalStep";
import AddressStep from "./steps/AddressStep";
import ReviewStep from "./steps/ReviewStep";
import {
  advanceMyDonorOnboardingStep,
  getMyDonorProfile,
} from "../../../../logic/api/donorsApi";
import { setOnboardingSkipped } from "../../../../logic/onboardingSkip";
import useAuthStore from "../../../../logic/store/useAuthStore";

const FIRST_STEP = 2;
const LAST_STEP = 4;

const DONOR_STEPS: OnboardingStepDef[] = [
  { step: 1, label: "Account" },
  { step: 2, label: "Personal" },
  { step: 3, label: "Address" },
  { step: 4, label: "Review" },
];

const donorStepPath = (step: number) => `/donor/onboarding/step/${step}`;

const DonorOnboardingWizard = () => {
  const { step: stepParam } = useParams();
  const [searchParams] = useSearchParams();
  const fromReview = searchParams.get("from") === "review";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const step = Number(stepParam);
  const furthestStep = user?.onboardingStep ?? FIRST_STEP;
  const outOfRange =
    !Number.isInteger(step) ||
    step < FIRST_STEP ||
    step > LAST_STEP ||
    step > furthestStep;

  const profileQuery = useQuery({
    queryKey: ["donor", "me"],
    queryFn: getMyDonorProfile,
  });

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate("/donor", { replace: true });
      return;
    }
    if (outOfRange) {
      const clamped = Math.min(Math.max(furthestStep, FIRST_STEP), LAST_STEP);
      navigate(donorStepPath(clamped), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.onboardingComplete, outOfRange, furthestStep]);

  const advanceMutation = useMutation({
    mutationFn: advanceMyDonorOnboardingStep,
    onSuccess: (donor) => {
      updateUser({ onboardingStep: donor.onboardingStep });
      queryClient.invalidateQueries({ queryKey: ["donor", "me"] });
      navigate(fromReview ? donorStepPath(LAST_STEP) : donorStepPath(step + 1));
    },
  });

  const handleContinue = () => advanceMutation.mutate(step);

  // Plain previous-step navigation — doesn't save what's typed on this step
  // (only Continue does). Undefined on the first step.
  const handleBack =
    step > FIRST_STEP ? () => navigate(donorStepPath(step - 1)) : undefined;

  // Doesn't complete onboarding — just lets the donor into the dashboard
  // for this browser session (OnboardingGate). The next real login brings
  // them back here.
  const handleSkip = () => {
    setOnboardingSkipped();
    navigate("/donor", { replace: true });
  };

  if (outOfRange || user?.onboardingComplete) {
    return null; // redirecting via the effect above
  }

  const profile = profileQuery.data;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 bg-neutral-offwhite px-4 py-10">
        {!profile ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-body text-sm text-neutral-gray">Loading…</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <OnboardingProgress
              steps={DONOR_STEPS}
              currentStep={step}
              furthestStep={furthestStep}
              onSkip={step !== LAST_STEP ? handleSkip : undefined}
              skipHint="You can still donate — finish this any time to complete your profile."
            />

            <Card className="p-6 md:p-8">
              {step === 2 && (
                <PersonalStep
                  profile={profile}
                  onContinue={handleContinue}
                  onBack={handleBack}
                />
              )}
              {step === 3 && (
                <AddressStep
                  profile={profile}
                  onContinue={handleContinue}
                  onBack={handleBack}
                />
              )}
              {step === 4 && <ReviewStep profile={profile} onBack={handleBack} />}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonorOnboardingWizard;
