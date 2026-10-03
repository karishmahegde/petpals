// VetOnboardingWizard.tsx
// Route element for /vet/onboarding/step/:step (ProtectedRoute +
// RoleRoute(["Veterinarian"]) in App.tsx). New vets sign up Pending and
// onboard BEFORE their shelter's manager approves them, so the manager sees
// a complete profile and can verify their ID first. Mandatory — no "Skip
// for now" (see OnboardingGate.tsx). Same steps as the staff wizard
// (StaffOnboardingWizard.tsx): 2 Personal, 3 Address, 4 Identity, 5 Review
// (Step 1, Account, is registration itself).
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
import IdentityStep from "./steps/IdentityStep";
import ReviewStep from "./steps/ReviewStep";
import {
  advanceMyVetOnboardingStep,
  getMyVetProfile,
} from "../../../../logic/api/vetsApi";
import useAuthStore from "../../../../logic/store/useAuthStore";

const FIRST_STEP = 2;
const LAST_STEP = 5;

const VET_STEPS: OnboardingStepDef[] = [
  { step: 1, label: "Account" },
  { step: 2, label: "Personal" },
  { step: 3, label: "Address" },
  { step: 4, label: "Identity" },
  { step: 5, label: "Review" },
];

const vetStepPath = (step: number) => `/vet/onboarding/step/${step}`;

const VetOnboardingWizard = () => {
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
    queryKey: ["vet", "me"],
    queryFn: getMyVetProfile,
  });

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate(user.accountStatus === "Pending" ? "/vet/pending" : "/vet", {
        replace: true,
      });
      return;
    }
    if (outOfRange) {
      const clamped = Math.min(Math.max(furthestStep, FIRST_STEP), LAST_STEP);
      navigate(vetStepPath(clamped), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.onboardingComplete, outOfRange, furthestStep]);

  const advanceMutation = useMutation({
    mutationFn: advanceMyVetOnboardingStep,
    onSuccess: (vet) => {
      updateUser({ onboardingStep: vet.onboardingStep });
      queryClient.invalidateQueries({ queryKey: ["vet", "me"] });
      navigate(fromReview ? vetStepPath(LAST_STEP) : vetStepPath(step + 1));
    },
  });

  const handleContinue = () => advanceMutation.mutate(step);

  // Plain previous-step navigation — doesn't save what's typed on this step
  // (only Continue does). Undefined on the first step.
  const handleBack =
    step > FIRST_STEP ? () => navigate(vetStepPath(step - 1)) : undefined;

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
              steps={VET_STEPS}
              currentStep={step}
              furthestStep={furthestStep}
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
              {step === 4 && (
                <IdentityStep onContinue={handleContinue} onBack={handleBack} />
              )}
              {step === 5 && <ReviewStep profile={profile} onBack={handleBack} />}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default VetOnboardingWizard;
