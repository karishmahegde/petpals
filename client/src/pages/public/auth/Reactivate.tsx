// Reactivate.tsx
// Page: where the emailed reactivation link lands (an account its owner
// closed).
// Responsibilities:
//   - Redeems ?token= once on mount (PATCH /auth/reactivation)
//   - Adopter / Donor come back Active → log in. Staff, Veterinarian and
//     Volunteer come back Pending → log in to the awaiting-approval page
//     (they may sign in while Pending). A Pending Admin can't sign in at
//     all, so they're told to wait for another admin instead
//   - A spent link (used / expired / invalid) → logging in again offers a
//     fresh one (Login's "Email me a reactivation link")
// Route: /reactivate?token=…
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import ButtonElement from "../../../components/ui/ButtonElement";
import { errorReason, reactivateAccount } from "../../../logic/api/authApi";
import { loginPathFor } from "../../../logic/route/resolveDestination";
import AuthCard, { authBodyClass, authPrimaryButtonClass } from "./shared/AuthCard";

// Roles that can sign in while Pending (server: PENDING_LOGIN_ROLES).
const PENDING_LOGIN_ROLES = new Set(["Staff", "Veterinarian", "Volunteer"]);

const Reactivate = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const mutation = useMutation({ mutationFn: reactivateAccount });

  // Once per mount: StrictMode runs effects twice in development, and a
  // second PATCH would find the token already used.
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const logInButton = (path: string) => (
    <ButtonElement
      onClick={() => navigate(path, { replace: true })}
      size="bare"
      className={authPrimaryButtonClass}
    >
      Log in
    </ButtonElement>
  );

  // When the role isn't known: the public login, with the way to the
  // worker portal underneath.
  const anyLogin = (
    <>
      {logInButton("/login")}
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
      <AuthCard title="Reopening your account…">
        <p className={authBodyClass}>This only takes a moment.</p>
      </AuthCard>
    );
  }

  if (mutation.isSuccess) {
    const { role, accountStatus } = mutation.data;
    if (accountStatus === "Active") {
      return (
        <AuthCard title="Welcome back 🎉">
          <p className={authBodyClass}>
            Your account is open again, with everything just as you left it.
          </p>
          {logInButton(loginPathFor(role))}
        </AuthCard>
      );
    }
    return (
      <AuthCard title="Your account is reopened">
        {PENDING_LOGIN_ROLES.has(role) ? (
          <>
            <p className={authBodyClass}>
              It needs approving again before you can get back to work — log
              in to see where that's at. We'll email you once it's approved.
            </p>
            {logInButton(loginPathFor(role))}
          </>
        ) : (
          <p className={authBodyClass}>
            Another admin needs to approve it before you can log in. We'll
            email you as soon as they do.
          </p>
        )}
      </AuthCard>
    );
  }

  const reason = token ? errorReason(mutation.error) : "token_invalid";
  if (reason === "not_closed") {
    return (
      <AuthCard title="This account is already open">
        <p className={authBodyClass}>
          There's nothing to reopen — you can log in as usual.
        </p>
        {anyLogin}
      </AuthCard>
    );
  }
  if (
    reason === "token_used" ||
    reason === "token_expired" ||
    reason === "token_invalid"
  ) {
    const title = {
      token_used: "This link has already been used",
      token_expired: "This link has expired",
      token_invalid: "This link isn't valid",
    }[reason];
    return (
      <AuthCard title={title}>
        <p className={authBodyClass}>
          To get a new one, log in with your email and password — you'll be
          offered a fresh reactivation link.
        </p>
        {anyLogin}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Something went wrong">
      <p className={authBodyClass}>
        We couldn't reopen your account just now. Please try again.
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

export default Reactivate;
