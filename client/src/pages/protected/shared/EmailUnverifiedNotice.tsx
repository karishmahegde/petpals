// EmailUnverifiedNotice.tsx
// The soft gate's face: shown in place of the submit button on the two
// actions that need a verified email — AdoptApply and the donor DonateForm
// (the server answers 409 "email_unverified" otherwise). Says why, and
// offers Resend right there, so nobody has to go looking for the banner.
// Verifying in another tab only updates that tab's session; a reload here
// restores the session from the server, verified.
import ButtonElement from "../../../components/ui/ButtonElement";
import useResendVerification from "../../../logic/hooks/useResendVerification";

interface EmailUnverifiedNoticeProps {
  /** What's waiting on it, e.g. "apply to adopt" or "donate". */
  action: string;
}

const EmailUnverifiedNotice = ({ action }: EmailUnverifiedNoticeProps) => {
  const verification = useResendVerification();

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-gold-md bg-gold-light p-4"
    >
      <div>
        <p className="font-body text-sm font-bold text-neutral-charcoal">
          Verify your email first
        </p>
        <p className="mt-1 font-body text-xs text-neutral-charcoal">
          You'll need a verified email address to {action}. Open the link we
          emailed you — if you verified in another tab, reload this page.
        </p>
      </div>
      <ButtonElement
        onClick={verification.resend}
        disabled={verification.pending}
        size="panel"
        className="w-full bg-teal-dark hover:brightness-95 disabled:opacity-60"
      >
        {verification.pending ? "Sending…" : "Resend verification email"}
      </ButtonElement>
    </div>
  );
};

export default EmailUnverifiedNotice;
