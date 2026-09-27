// StaffOnboardingWizard.tsx
// Route element for /staff/onboarding/step/:step (ProtectedRoute +
// RoleRoute(["Staff"]) in App.tsx). New staff sign up Pending and onboard
// BEFORE they're approved, so whoever approves them sees a complete profile
// and can verify their ID first. Mandatory — no "Skip for now" (see
// OnboardingGate.tsx). Steps: 2 Personal, 3 Address, 4 Identity, 5 Review
// (Step 1, Account, is registration itself).
// Mirrors the adopter OnboardingWizard: owns the profile fetch and the
// step-clamping, and hands each step the profile plus an onContinue that
// advances onboardingStep — to the next step, or back to Review when the
// step was opened from Review's Edit link (?from=review).
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
  advanceMyStaffOnboardingStep,
  getMyStaffProfile,
} from "../../../../logic/api/staffApi";
import useAuthStore from "../../../../logic/store/useAuthStore";

const FIRST_STEP = 2;
const LAST_STEP = 5;

const STAFF_STEPS: OnboardingStepDef[] = [
  { step: 1, label: "Account" },
  { step: 2, label: "Personal" },
  { step: 3, label: "Address" },
  { step: 4, label: "Identity" },
  { step: 5, label: "Review" },
];

const stepPath = (step: number) => `/staff/onboarding/step/${step}`;

const StaffOnboardingWizard = () => {
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
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate(user.accountStatus === "Pending" ? "/staff/pending" : "/staff", {
        replace: true,
      });
      return;
    }
    if (outOfRange) {
      const clamped = Math.min(Math.max(furthestStep, FIRST_STEP), LAST_STEP);
      navigate(stepPath(clamped), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.onboardingComplete, outOfRange, furthestStep]);

  const advanceMutation = useMutation({
    mutationFn: advanceMyStaffOnboardingStep,
    onSuccess: (staff) => {
      updateUser({ onboardingStep: staff.onboardingStep });
      queryClient.invalidateQueries({ queryKey: ["staff", "me"] });
      navigate(fromReview ? stepPath(LAST_STEP) : stepPath(step + 1));
    },
  });

  const handleContinue = () => advanceMutation.mutate(step);

  // Plain previous-step navigation — doesn't save what's typed on this step
  // (only Continue does). Undefined on the first step.
  const handleBack =
    step > FIRST_STEP ? () => navigate(stepPath(step - 1)) : undefined;

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
              steps={STAFF_STEPS}
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

export default StaffOnboardingWizard;
