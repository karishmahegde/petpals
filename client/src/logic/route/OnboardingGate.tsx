// OnboardingGate.tsx
// Cross-cutting guard: an Adopter whose onboarding isn't complete is
// redirected to their current onboarding step for every route they try to
// access — catalog, dashboard, adoption application, everything — except
// the wizard itself and /login. Wraps the entire route tree in App.tsx, so
// it's the single onboarding-aware code path; no other route/guard needs to
// know about onboarding state.
//
// "Skip for now" (see OnboardingWizard.tsx) sets a sessionStorage flag that
// lifts this gate everywhere EXCEPT the adopt-application flow, which stays
// blocked until onboarding is genuinely completed — matches the spec's
// "only once they finish it, it should go to the adopt screen".
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../../logic/store/useAuthStore";
import { isOnboardingSkipped } from "../../logic/onboardingSkip";

const ALWAYS_EXEMPT_PREFIXES = ["/onboarding", "/login"];
// Still gated even when onboarding was skipped for this session.
const BLOCKED_WHEN_SKIPPED_PREFIXES = ["/adopt/apply"];

interface OnboardingGateProps {
  children: ReactNode;
}

const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const { user, role } = useAuthStore();
  const location = useLocation();

  const alwaysExempt = ALWAYS_EXEMPT_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
  const blockedEvenWhenSkipped = BLOCKED_WHEN_SKIPPED_PREFIXES.some(
    (prefix) => location.pathname.startsWith(prefix),
  );
  const skipped = isOnboardingSkipped();

  const shouldGate =
    role === "Adopter" &&
    user?.onboardingComplete === false &&
    !alwaysExempt &&
    (!skipped || blockedEvenWhenSkipped);

  if (shouldGate) {
    return (
      <Navigate to={`/onboarding/step/${user.onboardingStep ?? 2}`} replace />
    );
  }

  return <>{children}</>;
};

export default OnboardingGate;
