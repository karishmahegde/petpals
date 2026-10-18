// components/ui/profile/EmailVerificationStatus.tsx
// The identity strip's "Email verified" mark, or a "Verify email" button
// when not verified yet — shared by every role's Profile page. The button
// only reports the click (`onVerify`); the page owns the call
// (logic/hooks/useResendVerification), keeping API calls out of components/.
import { PiSealCheck } from "react-icons/pi";
import ButtonElement from "../ButtonElement";

interface EmailVerificationStatusProps {
  verified: boolean;
  /** Sends a new verification link. */
  onVerify: () => void;
  /** True while that request is in flight. */
  pending: boolean;
}

const EmailVerificationStatus = ({
  verified,
  onVerify,
  pending,
}: EmailVerificationStatusProps) =>
  verified ? (
    <span className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-green">
      <PiSealCheck className="h-4 w-4" aria-hidden />
      Email verified
    </span>
  ) : (
    <ButtonElement
      onClick={onVerify}
      disabled={pending}
      size="bare"
      className="rounded-xl bg-teal-dark px-4 py-1.5 font-body text-sm font-medium hover:brightness-95 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Verify email"}
    </ButtonElement>
  );

export default EmailVerificationStatus;
