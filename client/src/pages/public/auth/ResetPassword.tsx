// ResetPassword.tsx
// Page: where the emailed password reset link lands.
// Responsibilities:
//   - New password + confirm (the live rules checklist, same as Register),
//     then PATCH /auth/password-reset with ?token=
//   - The reset signs out every session, this tab's included; the response's
//     role picks the login page to go to (public or staff portal)
//   - A spent link (used / expired / invalid) offers a new one instead
// Route: /reset-password?token=…
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import ButtonElement from "../../../components/ui/ButtonElement";
import PasswordRequirements from "../../../components/ui/PasswordRequirements";
import { errorReason, resetPassword } from "../../../logic/api/authApi";
import { meetsPasswordRequirements } from "../../../logic/utils/password";
import { loginPathFor } from "../../../logic/route/resolveDestination";
import useAuthStore from "../../../logic/store/useAuthStore";
import AuthCard, {
  authBodyClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "./shared/AuthCard";

const LINK_REASONS = ["token_invalid", "token_expired", "token_used"];

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPassword(token!, password),
    onSuccess: () => {
      // The server has already ended every session; drop this tab's too.
      if (useAuthStore.getState().token) logout();
    },
    onError: (err) => {
      if (LINK_REASONS.includes(errorReason(err) ?? "")) return;
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : "Unable to connect to the server. Please try again later.",
      );
    },
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!meetsPasswordRequirements(password))
      return setError("Password does not meet all requirements");
    if (password !== confirm) return setError("The passwords don't match");
    setError("");
    mutation.mutate();
  };

  const requestNewLink = (
    <ButtonElement
      onClick={() => navigate("/forgot-password", { replace: true })}
      size="bare"
      className={authPrimaryButtonClass}
    >
      Send me a new link
    </ButtonElement>
  );

  if (mutation.isSuccess) {
    return (
      <AuthCard title="Password updated 🔒">
        <p className={authBodyClass}>
          Your new password is set, and you've been signed out everywhere else.
          Log in with it to carry on.
        </p>
        <ButtonElement
          onClick={() =>
            navigate(loginPathFor(mutation.data.role), { replace: true })
          }
          size="bare"
          className={authPrimaryButtonClass}
        >
          Log in
        </ButtonElement>
      </AuthCard>
    );
  }

  const reason = token ? errorReason(mutation.error) : "token_invalid";
  if (reason === "token_used") {
    return (
      <AuthCard title="This link has already been used">
        <p className={authBodyClass}>
          Each reset link works once. If you didn't finish choosing a password,
          ask for a new link.
        </p>
        {requestNewLink}
      </AuthCard>
    );
  }
  if (reason === "token_expired") {
    return (
      <AuthCard title="This link has expired">
        <p className={authBodyClass}>
          Reset links work for 1 hour, to keep your account safe.
        </p>
        {requestNewLink}
      </AuthCard>
    );
  }
  if (reason === "token_invalid") {
    return (
      <AuthCard title="This link isn't valid">
        <p className={authBodyClass}>
          It may be incomplete, or a newer link has replaced it — only the most
          recent one works.
        </p>
        {requestNewLink}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={authLabelClass}>
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className={authInputClass}
          />
          <PasswordRequirements password={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className={authLabelClass}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••••••"
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
          {mutation.isPending ? "Saving…" : "Set new password"}
        </ButtonElement>
      </form>
    </AuthCard>
  );
};

export default ResetPassword;
