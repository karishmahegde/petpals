// ForgotPassword.tsx
// Page: asks for an email and sends a password reset link.
// Responsibilities:
//   - POST /auth/password-reset, then the same "check your inbox" message
//     whether or not the email has an account — the server never says, so
//     the page can't be used to find out who's registered
//   - ?portal=staff (from WorkerLogin) keeps the worker portal's look and
//     its Back to login target
// Route: /forgot-password
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import ButtonElement from "../../../components/ui/ButtonElement";
import { requestPasswordReset } from "../../../logic/api/authApi";
import AuthCard, {
  authBodyClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "./shared/AuthCard";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const portal = searchParams.get("portal") === "staff" ? "staff" : "public";
  const loginPath = portal === "staff" ? "/staff-portal/login" : "/login";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onError: () =>
      setError("Unable to connect to the server. Please try again later."),
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return setError("Please enter your email");
    if (!emailRegex.test(email.trim()))
      return setError("Please enter a valid email address");
    setError("");
    mutation.mutate(email.trim());
  };

  const backToLogin = (
    <ButtonElement
      onClick={() => navigate(loginPath)}
      size="bare"
      variant="outline"
      className="self-center font-body text-sm font-semibold text-teal-dark hover:underline"
    >
      Back to login
    </ButtonElement>
  );

  if (mutation.isSuccess) {
    return (
      <AuthCard title="Check your inbox 📬" portal={portal}>
        <p className={authBodyClass}>
          If there's an account for{" "}
          <span className="font-semibold">{email.trim()}</span>, we've emailed
          it a link to reset the password. The link works for 1 hour.
        </p>
        <p className="font-body text-xs text-neutral-gray">
          Nothing arrived? Check your spam folder, or wait a minute and try
          again.
        </p>
        {backToLogin}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot password?" portal={portal}>
      <p className={authBodyClass}>
        Enter the email you sign in with and we'll send you a link to choose a
        new password.
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.doe@email.com"
            className={authInputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-rose-dark bg-rose-light px-4 py-2.5 font-body text-sm text-rose-dark">
            {error}
          </p>
        )}

        <ButtonElement
          type="submit"
          disabled={mutation.isPending}
          size="bare"
          className={authPrimaryButtonClass}
        >
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </ButtonElement>
      </form>
      {backToLogin}
    </AuthCard>
  );
};

export default ForgotPassword;
