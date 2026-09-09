// AdoptApplyConfirmation.tsx
// Page: post-Stripe-Checkout landing page. Route: /adopt/apply/:petID/confirmation
// Never assumes payment succeeded just because the redirect happened - the
// AdoptionApplication row is only ever created by the Stripe webhook, which
// can lag slightly behind the browser's own redirect. This page polls for
// that row rather than trusting client-side payment state (see Part 5 spec
// §3.3/§4.2). Guarded only by ProtectedRoute + RoleRoute(["Adopter"]) in
// App.tsx - no pet-availability/duplicate-application re-check here, since
// payment already happened and the webhook may be creating that very row
// while this page is polling for it.
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Card from "../../../../components/ui/Card";
import { getApplicationByCheckoutSession } from "../../../../logic/api/adoptionApplicationsApi";
import { clearApplyDraft } from "../../../../logic/adoptApplyDraft";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;
const AUTO_REDIRECT_DELAY_MS = 5000;

const AdoptApplyConfirmation = () => {
  const { petID: petIDParam } = useParams();
  const petID = Number(petIDParam);
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();

  const [elapsedMs, setElapsedMs] = useState(0);
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;

  const { data: application } = useQuery({
    queryKey: ["adoptionApplication", "byCheckoutSession", sessionId],
    queryFn: () => getApplicationByCheckoutSession(sessionId!),
    enabled: !!sessionId && !timedOut,
    refetchInterval: (query) => (query.state.data ? false : POLL_INTERVAL_MS),
  });

  // Tracks how long we've been polling, purely to decide when to show the
  // "still processing" fallback - separate from the query itself.
  useEffect(() => {
    if (!sessionId || application) return;
    const interval = setInterval(
      () => setElapsedMs((ms) => ms + POLL_INTERVAL_MS),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [sessionId, application]);

  // Once found: clear the now-unneeded draft and auto-redirect after a
  // short delay (the explicit "Go to Dashboard" button below covers anyone
  // who doesn't want to wait).
  useEffect(() => {
    if (!application) return;
    clearApplyDraft(petID);
    const timeout = setTimeout(
      () => navigate("/adopter", { replace: true }),
      AUTO_REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [application, petID, navigate]);

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="font-body text-sm text-rose-dark">
          Missing checkout session - if you just paid, check your dashboard for
          your application.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-offwhite px-4 py-10">
      <Card className="w-full max-w-md p-8 text-center">
        {application ? (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Application submitted!
            </h1>
            <p className="font-body text-sm text-neutral-charcoal">
              Your {application.applicationType.toLowerCase()} application
              {application.pet ? ` for ${application.pet.petName}` : ""} is in.
              We'll be in touch soon.
            </p>
            <button
              type="button"
              onClick={() => navigate("/adopter", { replace: true })}
              className="mt-6 w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
            >
              Go to Dashboard
            </button>
          </>
        ) : timedOut ? (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Still processing
            </h1>
            <p className="font-body text-sm text-neutral-charcoal">
              Your payment is being finalized - this can take a minute. Check
              your dashboard shortly for your application.
            </p>
            <button
              type="button"
              onClick={() => navigate("/adopter", { replace: true })}
              className="mt-6 w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Finalizing your application…
            </h1>
            <p className="font-body text-sm text-neutral-gray">
              Just a moment while we confirm your payment.
            </p>
          </>
        )}
      </Card>
    </div>
  );
};

export default AdoptApplyConfirmation;
