// ReactivationOffer.tsx
// Shown under the error on Login and WorkerLogin when the password was
// right but the account is one its owner closed (error.details.reason
// "account_closed"): one button that emails a reactivation link to the
// address they just typed. The server answers 200 whatever happens (it
// never confirms an account), so "sent" is all there is to show.
import { useMutation } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import { requestReactivation } from "../../../../logic/api/authApi";

const ReactivationOffer = ({ email }: { email: string }) => {
  const mutation = useMutation({ mutationFn: requestReactivation });

  if (mutation.isSuccess) {
    return (
      <p className="rounded-lg border border-gold-md bg-gold-light px-4 py-2.5 font-body text-sm text-neutral-charcoal">
        Check your inbox — we've emailed a reactivation link to{" "}
        <span className="font-semibold">{email}</span>. It works for 24 hours.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ButtonElement
        onClick={() => mutation.mutate(email)}
        disabled={mutation.isPending}
        size="bare"
        className="w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-semibold hover:brightness-95 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Email me a reactivation link"}
      </ButtonElement>
      {mutation.isError && (
        <p className="font-body text-xs text-rose-dark">
          Couldn't send it just now. Please try again.
        </p>
      )}
    </div>
  );
};

export default ReactivationOffer;
