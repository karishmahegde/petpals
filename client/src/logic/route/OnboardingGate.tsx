// OnboardingGate.tsx
// Cross-cutting guard: an Adopter, Staff member or Veterinarian whose
// onboarding isn't complete is redirected to their current onboarding step
// for every route
// they try to access — catalog, dashboard, adoption application, everything
// — except the wizard itself and /login. Wraps the entire route tree in
// App.tsx, so it's the single onboarding-aware code path; no other
// route/guard needs to know about onboarding state.
//
// Adopter: "Skip for now" (see OnboardingWizard.tsx) sets a sessionStorage
// flag that lifts this gate everywhere EXCEPT the adopt-application flow,
// which stays blocked until onboarding is genuinely completed — matches the
// spec's "only once they finish it, it should go to the adopt screen".
//
// Staff and Veterinarian: onboarding is mandatory (no skip) and happens
// BEFORE approval. A Pending staff member or vet who has finished
// onboarding is held on their role's pending page until they're approved.
// The server enforces the same boundary — a Pending account can only reach
// its own onboarding endpoints (authenticate.allowPending) — this just
// keeps the UI on the one page that works for them.
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../../logic/store/useAuthStore";
import { isOnboardingSkipped } from "../../logic/onboardingSkip";

const ALWAYS_EXEMPT_PREFIXES = ["/onboarding", "/login"];
// Still gated even when onboarding was skipped for this session.
const BLOCKED_WHEN_SKIPPED_PREFIXES = ["/adopt/apply"];

// Roles that onboard before approval → their wizard and pending page.
const APPROVAL_ROLE_PATHS: Record<string, { onboarding: string; pending: string }> = {
  Staff: { onboarding: "/staff/onboarding", pending: "/staff/pending" },
  Veterinarian: { onboarding: "/vet/onboarding", pending: "/vet/pending" },
};

interface OnboardingGateProps {
  children: ReactNode;
}

const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const { user, role } = useAuthStore();
  const location = useLocation();
  const path = location.pathname;
  const startsWithAny = (prefixes: string[]) =>
    prefixes.some((prefix) => path.startsWith(prefix));

  const approvalPaths = role ? APPROVAL_ROLE_PATHS[role] : undefined;
  if (approvalPaths && user) {
    if (user.onboardingComplete === false) {
      if (!startsWithAny([approvalPaths.onboarding, "/login"])) {
        return (
          <Navigate
            to={`${approvalPaths.onboarding}/step/${user.onboardingStep ?? 2}`}
            replace
          />
        );
      }
    } else if (user.accountStatus === "Pending") {
      if (!startsWithAny([approvalPaths.pending, "/login"])) {
        return <Navigate to={approvalPaths.pending} replace />;
      }
    }
    return <>{children}</>;
  }

  const alwaysExempt = startsWithAny(ALWAYS_EXEMPT_PREFIXES);
  const blockedEvenWhenSkipped = startsWithAny(BLOCKED_WHEN_SKIPPED_PREFIXES);
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
