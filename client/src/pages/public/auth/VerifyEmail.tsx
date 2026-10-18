// VerifyEmail.tsx
// Page: where the emailed verification link lands.
// Responsibilities:
//   - Redeems ?token= once on mount (PATCH /auth/email-verification) — no
//     session needed, since the link may be opened on another device
//   - Success: if this tab is signed in, the session and every cached
//     profile catch up (the banner and the Profile button go away)
//   - A spent link (used / expired / invalid) explains itself and points to
//     the next step: Resend when signed in, otherwise log in first
// Route: /verify-email?token=…
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import Card from "../../../components/ui/Card";
import ButtonElement from "../../../components/ui/ButtonElement";
import { errorReason, verifyEmail } from "../../../logic/api/authApi";
import { dashboardPathFor } from "../../../logic/route/resolveDestination";
import useAuthStore from "../../../logic/store/useAuthStore";
import useResendVerification from "../../../logic/hooks/useResendVerification";
import { queryClient } from "../../../logic/queryClient";
import backgroundImg from "../../../static/assets/images/background.png";

const primaryButton =
  "w-full rounded-xl bg-rose-dark py-3 font-body text-sm font-semibold hover:brightness-95 disabled:opacity-60";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const updateUser = useAuthStore((state) => state.updateUser);
  const verification = useResendVerification();

  const mutation = useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => {
      updateUser({ emailVerified: true });
      queryClient.invalidateQueries();
    },
  });

  // Once per mount: StrictMode runs effects twice in development, and a
  // second PATCH would find the token already used.
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reason = token ? errorReason(mutation.error) : "token_invalid";

  // Every finished state ends with one way forward.
  const continueButton = role ? (
    <ButtonElement
      onClick={() => navigate(dashboardPathFor(role), { replace: true })}
      size="bare"
      className={primaryButton}
    >
      Go to your dashboard
    </ButtonElement>
  ) : (
    <ButtonElement
      onClick={() => navigate("/login", { replace: true })}
      size="bare"
      className={primaryButton}
    >
      Log in
    </ButtonElement>
  );

  // A link that can't be used any more: a new one comes from Resend, which
  // needs a session.
  const newLinkAction = role ? (
    <ButtonElement
      onClick={verification.resend}
      disabled={verification.pending}
      size="bare"
      className={primaryButton}
    >
      {verification.pending ? "Sending…" : "Send me a new link"}
    </ButtonElement>
  ) : (
    <>
      <p className="font-body text-sm text-neutral-charcoal">
        Log in and use <span className="font-semibold">Resend email</span> at
        the top of your dashboard to get a new one.
      </p>
      {continueButton}
      <p className="text-center font-body text-xs text-neutral-gray">
        Staff, vets and admins:{" "}
        <Link
          to="/staff-portal/login"
          className="font-semibold text-teal-dark hover:underline"
        >
          log in to the staff portal
        </Link>
      </p>
    </>
  );

  let title: string;
  let body: React.ReactNode;
  if (token && (mutation.isIdle || mutation.isPending)) {
    title = "Verifying your email…";
    body = (
      <p className="font-body text-sm text-neutral-charcoal">
        This only takes a moment.
      </p>
    );
  } else if (mutation.isSuccess) {
    title = "Email verified 🎉";
    body = (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          Thanks — your email address is confirmed. You can now apply to adopt
          and donate.
        </p>
        {continueButton}
      </>
    );
  } else if (reason === "token_used") {
    title = "This link has already been used";
    body = (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          If you opened it before, your email is already verified and you're
          all set.
        </p>
        {continueButton}
      </>
    );
  } else if (reason === "token_expired") {
    title = "This link has expired";
    body = (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          Verification links work for 24 hours.
        </p>
        {newLinkAction}
      </>
    );
  } else if (reason === "token_invalid") {
    title = "This link isn't valid";
    body = (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          It may be incomplete, or a newer link has replaced it — only the
          most recent one works.
        </p>
        {newLinkAction}
      </>
    );
  } else {
    title = "Something went wrong";
    body = (
      <>
        <p className="font-body text-sm text-neutral-charcoal">
          We couldn't verify your email just now. Please try again.
        </p>
        <ButtonElement
          onClick={() => token && mutation.mutate(token)}
          size="bare"
          className={primaryButton}
        >
          Try again
        </ButtonElement>
      </>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center px-4 py-2"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-md p-12">
        <h1 className="mb-6 text-center font-display text-3xl text-neutral-dark">
          {title}
        </h1>
        <div className="flex flex-col gap-5">{body}</div>
      </Card>
    </div>
  );
};

export default VerifyEmail;
