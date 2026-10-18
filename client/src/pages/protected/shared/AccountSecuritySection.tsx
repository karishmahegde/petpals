// AccountSecuritySection.tsx
// "Account & security" card on every role's Profile page, just above the
// Danger zone: change password and change login email, both confirmed with
// the current password. Imports the auth API, so it lives under pages/, not
// components/.
// Each form is mounted only while open (conditional render, not `hidden`),
// so closing one wipes whatever passwords were typed into it.
// - Password: PATCH /auth/password. This session stays signed in (the server
//   re-issues its refresh cookie); every other session is signed out.
// - Email: POST /auth/email-change sends a confirmation link to the NEW
//   address; nothing changes until it's opened (ConfirmEmailChange page).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import ButtonElement from "../../../components/ui/ButtonElement";
import PasswordRequirements from "../../../components/ui/PasswordRequirements";
import {
  changePassword,
  errorReason,
  requestEmailChange,
} from "../../../logic/api/authApi";
import { meetsPasswordRequirements } from "../../../logic/utils/password";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 45; // Users.userEmail VARCHAR(45)

const labelClass = "font-body text-xs text-neutral-gray";
const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-gray px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";
const primaryButton =
  "rounded-xl bg-teal-dark px-5 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-60";
const cancelButton =
  "rounded-xl bg-red px-5 py-2 text-sm font-medium hover:brightness-95 disabled:opacity-60";
const errorClass =
  "rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark";

const serverMessage = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

// ——————————————— Change password ———————————————
const ChangePasswordForm = ({ onDone }: { onDone: () => void }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed");
      onDone();
    },
    onError: (err) =>
      setError(
        errorReason(err) === "wrong_password"
          ? "Your current password is incorrect."
          : serverMessage(err),
      ),
  });

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return setError("Please enter your current password.");
    if (!meetsPasswordRequirements(next))
      return setError("Your new password does not meet all requirements.");
    if (next === current)
      return setError("Your new password must be different from the current one.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setError("");
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <div className="sm:max-w-sm">
        <label htmlFor="current-password" className={labelClass}>
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:max-w-sm">
        <label htmlFor="new-password" className={labelClass}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className={inputClass}
        />
        <PasswordRequirements password={next} />
      </div>
      <div className="sm:max-w-sm">
        <label htmlFor="confirm-password" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && <p className={errorClass}>{error}</p>}

      <div className="flex justify-end gap-3">
        <ButtonElement
          onClick={onDone}
          disabled={mutation.isPending}
          size="bare"
          className={cancelButton}
        >
          Cancel
        </ButtonElement>
        <ButtonElement
          type="submit"
          disabled={mutation.isPending}
          size="bare"
          className={primaryButton}
        >
          {mutation.isPending ? "Saving…" : "Update password"}
        </ButtonElement>
      </div>
    </form>
  );
};

// ——————————————— Change email ———————————————
const ChangeEmailForm = ({
  currentEmail,
  onDone,
}: {
  currentEmail: string;
  onDone: () => void;
}) => {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => requestEmailChange(newEmail.trim(), password),
    onError: (err) => {
      const reason = errorReason(err);
      if (reason === "wrong_password")
        return setError("Your current password is incorrect.");
      if (reason === "email_taken")
        return setError("Another account already uses that address.");
      if (axios.isAxiosError(err) && err.response?.status === 429)
        return setError(
          "We just sent a link — please wait a minute before asking again.",
        );
      setError(serverMessage(err));
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gold-md bg-gold-light p-4">
        <p className="font-body text-sm text-neutral-charcoal">
          <span className="font-bold">Check your new inbox.</span> We've sent a
          confirmation link to{" "}
          <span className="font-semibold">{newEmail.trim()}</span>. You'll keep
          logging in with {currentEmail} until you open it — the link works for
          24 hours.
        </p>
        <ButtonElement
          onClick={onDone}
          size="bare"
          className={`${primaryButton} self-end`}
        >
          Done
        </ButtonElement>
      </div>
    );
  }

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!emailRegex.test(email))
      return setError("Please enter a valid email address.");
    if (email.length > MAX_EMAIL_LEN)
      return setError(`Email addresses can be at most ${MAX_EMAIL_LEN} characters.`);
    if (email.toLowerCase() === currentEmail.toLowerCase())
      return setError("That's already your login email.");
    if (!password) return setError("Please enter your current password.");
    setError("");
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <div className="sm:max-w-sm">
        <label htmlFor="new-email" className={labelClass}>
          New email address
        </label>
        <input
          id="new-email"
          type="email"
          autoComplete="email"
          maxLength={MAX_EMAIL_LEN}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:max-w-sm">
        <label htmlFor="email-change-password" className={labelClass}>
          Current password
        </label>
        <input
          id="email-change-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && <p className={errorClass}>{error}</p>}

      <div className="flex justify-end gap-3">
        <ButtonElement
          onClick={onDone}
          disabled={mutation.isPending}
          size="bare"
          className={cancelButton}
        >
          Cancel
        </ButtonElement>
        <ButtonElement
          type="submit"
          disabled={mutation.isPending}
          size="bare"
          className={primaryButton}
        >
          {mutation.isPending ? "Sending…" : "Send confirmation link"}
        </ButtonElement>
      </div>
    </form>
  );
};

// ——————————————— Section ———————————————
const AccountSecuritySection = ({ currentEmail }: { currentEmail: string }) => {
  const [open, setOpen] = useState<"password" | "email" | null>(null);
  const close = () => setOpen(null);

  return (
    <section className="mt-10 rounded-2xl border border-rose-light bg-white p-5 md:p-6">
      <h2 className="mb-4 font-display text-lg text-neutral-dark">
        Account &amp; security
      </h2>

      <div className="flex flex-col divide-y divide-rose-light">
        <div className="pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={labelClass}>Password</p>
              <p className="mt-1 font-body text-sm text-neutral-dark">
                Changing it signs you out on your other devices.
              </p>
            </div>
            {open !== "password" && (
              <ButtonElement
                onClick={() => setOpen("password")}
                size="bare"
                className={primaryButton}
              >
                Change password
              </ButtonElement>
            )}
          </div>
          {open === "password" && <ChangePasswordForm onDone={close} />}
        </div>

        <div className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={labelClass}>Login email</p>
              <p className="mt-1 break-all font-body text-sm text-neutral-dark">
                {currentEmail}
              </p>
            </div>
            {open !== "email" && (
              <ButtonElement
                onClick={() => setOpen("email")}
                size="bare"
                className={primaryButton}
              >
                Change email
              </ButtonElement>
            )}
          </div>
          {open === "email" && (
            <ChangeEmailForm currentEmail={currentEmail} onDone={close} />
          )}
        </div>
      </div>
    </section>
  );
};

export default AccountSecuritySection;
