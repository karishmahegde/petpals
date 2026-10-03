// DonateConfirmation.tsx
// Where Stripe returns a donor after paying: /donor/donate/confirmation
// ?session_id=… Never assumes the payment went through just because the
// redirect happened — the Donation row is only created by the Stripe
// webhook, which can lag behind the browser. So this polls GET
// /donors/me/donations?checkoutSessionId= (null until the webhook lands),
// the same approach as the adoption fee's AdoptApplyConfirmation, and falls
// back to "still processing" after a while. Once found, every
// ["donor", "donations"] query is refreshed so the totals and lists
// include it.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Card from "../../../../components/ui/Card";
import { getDonationByCheckoutSession } from "../../../../logic/api/donorsApi";
import { formatUSD } from "../../../../logic/utils/currency";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

const DonateConfirmation = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [elapsedMs, setElapsedMs] = useState(0);
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;

  // Not under ["donor", "donations"], so the invalidation below doesn't
  // restart this poll.
  const { data: donation } = useQuery({
    queryKey: ["donor", "donationByCheckoutSession", sessionId],
    queryFn: () => getDonationByCheckoutSession(sessionId!),
    enabled: !!sessionId && !timedOut,
    refetchInterval: (query) => (query.state.data ? false : POLL_INTERVAL_MS),
  });

  // How long we've been polling — only to decide when to show the "still
  // processing" fallback.
  useEffect(() => {
    if (!sessionId || donation) return;
    const interval = setInterval(
      () => setElapsedMs((ms) => ms + POLL_INTERVAL_MS),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [sessionId, donation]);

  useEffect(() => {
    if (donation) {
      queryClient.invalidateQueries({ queryKey: ["donor", "donations"] });
    }
  }, [donation, queryClient]);

  const goToDashboard = () => navigate("/donor", { replace: true });

  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-md p-8 text-center">
        {!sessionId ? (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Nothing to confirm
            </h1>
            <p className="font-body text-sm text-neutral-charcoal">
              This page is missing its checkout session — if you just donated,
              your donation will appear on your dashboard shortly.
            </p>
          </>
        ) : donation ? (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Thank you! 💛
            </h1>
            <p className="font-body text-sm text-neutral-charcoal">
              Your donation of{" "}
              <strong>{formatUSD(donation.donationAmt)}</strong> to{" "}
              <strong>{donation.shelter.shelterName}</strong> has been received.
            </p>
          </>
        ) : timedOut ? (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Still processing
            </h1>
            <p className="font-body text-sm text-neutral-charcoal">
              Your payment is being finalized — this can take a minute. Check
              your dashboard shortly for your donation.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 font-display text-2xl text-neutral-dark">
              Confirming your donation…
            </h1>
            <p className="font-body text-sm text-neutral-gray">
              Just a moment while we confirm your payment.
            </p>
          </>
        )}

        {(!sessionId || donation || timedOut) && (
          <ButtonElement
            onClick={goToDashboard}
            size="panel"
            className="mt-6 w-full bg-teal-dark hover:brightness-95"
          >
            Go to Dashboard
          </ButtonElement>
        )}
      </Card>
    </div>
  );
};

export default DonateConfirmation;
