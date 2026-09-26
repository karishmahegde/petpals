// components/ui/profile/EmailVerificationStatus.tsx
// The identity strip's "Email verified" mark, or a "Verify email" button
// when not verified yet — shared by every role's Profile page. There's no
// verification flow yet, so the button only says so.
import toast from "react-hot-toast";
import { PiSealCheck } from "react-icons/pi";
import ButtonElement from "../ButtonElement";

const EmailVerificationStatus = ({ verified }: { verified: boolean }) =>
  verified ? (
    <span className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-green">
      <PiSealCheck className="h-4 w-4" aria-hidden />
      Email verified
    </span>
  ) : (
    <ButtonElement
      onClick={() => toast("Email verification is coming soon.")}
      size="bare"
      className="rounded-xl bg-teal-dark px-4 py-1.5 font-body text-sm font-medium hover:brightness-95"
    >
      Verify email
    </ButtonElement>
  );

export default EmailVerificationStatus;
