// OnboardingWizard.tsx
// Route element for /onboarding/step/:step (wrapped in ProtectedRoute +
// RoleRoute(["Adopter"]) in App.tsx). Owns the profile fetch and the
// step-clamping/redirect logic, and hands each step component just what it
// needs: the profile to prefill from, and an onContinue callback that
// advances onboardingStep and navigates — either to the next step, or back
// to Review if this step was reached via ?from=review (§3.3: editing from
// Review doesn't re-force the steps in between).
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navbar from "../../../../components/layout/Navbar";
import Card from "../../../../components/ui/Card";
import OnboardingProgress from "./OnboardingProgress";
import PersonalStep from "./steps/PersonalStep";
import IdentityStep from "./steps/IdentityStep";
import HouseholdStep from "./steps/HouseholdStep";
import LifestyleStep from "./steps/LifestyleStep";
import PreferencesStep from "./steps/PreferencesStep";
import ReviewStep from "./steps/ReviewStep";
import {
  getAdopterProfile,
  advanceOnboardingStep,
} from "../../../../logic/api/adoptersApi";
import { setOnboardingSkipped } from "../../../../logic/onboardingSkip";
import useAuthStore from "../../../../logic/store/useAuthStore";

const OnboardingWizard = () => {
  const { step: stepParam } = useParams();
  const [searchParams] = useSearchParams();
  const fromReview = searchParams.get("from") === "review";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const step = Number(stepParam);
  const furthestStep = user?.onboardingStep ?? 2;
  const outOfRange =
    !Number.isInteger(step) || step < 2 || step > 7 || step > furthestStep;

  const profileQuery = useQuery({
    queryKey: ["adopter", "me"],
    queryFn: getAdopterProfile,
  });

  useEffect(() => {
    if (user?.onboardingComplete) {
      navigate("/adopter", { replace: true });
      return;
    }
    if (outOfRange) {
      const clamped = Math.min(Math.max(furthestStep, 2), 7);
      navigate(`/onboarding/step/${clamped}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.onboardingComplete, outOfRange, furthestStep]);

  const advanceMutation = useMutation({
    mutationFn: advanceOnboardingStep,
    onSuccess: (adopter) => {
      updateUser({ onboardingStep: adopter.onboardingStep });
      queryClient.invalidateQueries({ queryKey: ["adopter", "me"] });
      navigate(fromReview ? "/onboarding/step/7" : `/onboarding/step/${step + 1}`);
    },
  });

  const handleContinue = () => advanceMutation.mutate(step);

  // Doesn't complete onboarding — just lets the adopter browse the rest of
  // the app for this browser session (see OnboardingGate.tsx). The next
  // real login, or trying to actually apply to adopt a pet, brings them
  // straight back here.
  const handleSkip = () => {
    setOnboardingSkipped();
    navigate("/adopter", { replace: true });
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
              currentStep={step}
              furthestStep={furthestStep}
              onSkip={step !== 7 ? handleSkip : undefined}
            />

            <Card className="p-6 md:p-8">
              {step === 2 && (
                <PersonalStep profile={profile} onContinue={handleContinue} />
              )}
              {step === 3 && <IdentityStep onContinue={handleContinue} />}
              {step === 4 && (
                <HouseholdStep profile={profile} onContinue={handleContinue} />
              )}
              {step === 5 && (
                <LifestyleStep profile={profile} onContinue={handleContinue} />
              )}
              {step === 6 && (
                <PreferencesStep profile={profile} onContinue={handleContinue} />
              )}
              {step === 7 && <ReviewStep profile={profile} />}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
