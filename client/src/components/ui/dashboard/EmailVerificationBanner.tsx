// components/ui/dashboard/EmailVerificationBanner.tsx
// "Verify your email" strip at the top of every dashboard while the
// signed-in user's email isn't verified. Nothing is blocked by it except
// applying to adopt and donating, so it informs rather than nags — no
// dismiss, it goes away once they verify. The Resend click is reported up
// (`onResend`); DashboardLayout owns the call.
import { PiEnvelopeSimple } from "react-icons/pi";
import ButtonElement from "../ButtonElement";

interface EmailVerificationBannerProps {
  onResend: () => void;
  pending: boolean;
}

const EmailVerificationBanner = ({
  onResend,
  pending,
}: EmailVerificationBannerProps) => (
  <div
    role="status"
    className="mb-6 flex flex-col gap-3 rounded-lg border border-gold-md bg-gold-light p-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="flex items-start gap-3">
      <PiEnvelopeSimple
        className="mt-0.5 h-5 w-5 shrink-0 text-neutral-charcoal"
        aria-hidden
      />
      <p className="font-body text-sm text-neutral-charcoal">
        <span className="font-bold">Please verify your email address.</span>{" "}
        Open the link we emailed you — you'll need a verified email to apply to
        adopt or to donate.
      </p>
    </div>
    <ButtonElement
      onClick={onResend}
      disabled={pending}
      size="bare"
      className="shrink-0 rounded-xl bg-teal-dark px-4 py-1.5 font-body text-sm font-medium hover:brightness-95 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Resend email"}
    </ButtonElement>
  </div>
);

export default EmailVerificationBanner;
