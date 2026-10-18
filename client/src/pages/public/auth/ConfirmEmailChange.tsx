// ConfirmEmailChange.tsx
// Page: where the confirmation link (sent to the NEW address by Account &
// security's Change email) lands.
// Responsibilities:
//   - Redeems ?token= once on mount (PATCH /auth/email-change) — no session
//     needed, the link may be opened on another device
//   - Success: if this tab is signed in, the session and every cached
//     profile catch up, so the Profile shows the new address
//   - The address taken meanwhile, or a spent link → ask again from Profile
// Route: /confirm-email-change?token=…
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import ButtonElement from "../../../components/ui/ButtonElement";
import { confirmEmailChange, errorReason } from "../../../logic/api/authApi";
import { dashboardPathFor } from "../../../logic/route/resolveDestination";
import useAuthStore from "../../../logic/store/useAuthStore";
import { queryClient } from "../../../logic/queryClient";
import AuthCard, { authBodyClass, authPrimaryButtonClass } from "./shared/AuthCard";

const ConfirmEmailChange = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const updateUser = useAuthStore((state) => state.updateUser);

  const mutation = useMutation({
    mutationFn: confirmEmailChange,
    onSuccess: ({ userEmail }) => {
      // The link proves the new address, so it's verified too.
      updateUser({ userEmail, emailVerified: true });
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

  // Signed in → back to the Profile (where Change email lives); otherwise
  // log in, with the way to the worker portal underneath.
  const nextStep = role ? (
    <ButtonElement
      onClick={() => navigate(`${dashboardPathFor(role)}/profile`, { replace: true })}
      size="bare"
      className={authPrimaryButtonClass}
    >
      Go to your profile
    </ButtonElement>
  ) : (
    <>
      <ButtonElement
        onClick={() => navigate("/login", { replace: true })}
        size="bare"
        className={authPrimaryButtonClass}
      >
        Log in
      </ButtonElement>
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

  if (token && (mutation.isIdle || mutation.isPending)) {
    return (
      <AuthCard title="Confirming your new email…">
        <p className={authBodyClass}>This only takes a moment.</p>
      </AuthCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard title="Email updated ✉️">
        <p className={authBodyClass}>
          You'll now log in with{" "}
          <span className="font-semibold">{mutation.data.userEmail}</span>.
          We've let your old address know about the change.
        </p>
        {nextStep}
      </AuthCard>
    );
  }

  const reason = token ? errorReason(mutation.error) : "token_invalid";
  const askAgain = (
    <p className={authBodyClass}>
      You can ask again from{" "}
      <span className="font-semibold">Account &amp; security</span> on your
      Profile — your login email hasn't changed.
    </p>
  );

  if (reason === "email_taken") {
    return (
      <AuthCard title="That address is taken">
        <p className={authBodyClass}>
          Another account started using it after you asked, so we couldn't move
          yours to it.
        </p>
        {askAgain}
        {nextStep}
      </AuthCard>
    );
  }
  if (
    reason === "token_used" ||
    reason === "token_expired" ||
    reason === "token_invalid"
  ) {
    const { title, detail } = {
      token_used: {
        title: "This link has already been used",
        detail: "If you opened it before, your email has already been changed.",
      },
      token_expired: {
        title: "This link has expired",
        detail: "Email change links work for 24 hours.",
      },
      token_invalid: {
        title: "This link isn't valid",
        detail:
          "It may be incomplete, or a newer request has replaced it — only the most recent link works.",
      },
    }[reason];
    return (
      <AuthCard title={title}>
        <p className={authBodyClass}>{detail}</p>
        {askAgain}
        {nextStep}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Something went wrong">
      <p className={authBodyClass}>
        We couldn't confirm your new email just now. Please try again.
      </p>
      <ButtonElement
        onClick={() => token && mutation.mutate(token)}
        size="bare"
        className={authPrimaryButtonClass}
      >
        Try again
      </ButtonElement>
    </AuthCard>
  );
};

export default ConfirmEmailChange;
