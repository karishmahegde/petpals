import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaTimes } from "react-icons/fa";
import useAuthStore from "../../../../logic/store/useAuthStore";
import {
  closeAccount,
  type CloseAccountMode,
} from "../../../../logic/api/adoptersApi";

interface CloseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Word the adopter must type to enable the action button - avoids a
// one-click destructive action for either mode.
const CONFIRM_WORD: Record<CloseAccountMode, string> = {
  deactivate: "DEACTIVATE",
  delete: "DELETE",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const CloseAccountModal = ({ isOpen, onClose }: CloseAccountModalProps) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CloseAccountMode | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const reset = () => {
    setMode(null);
    setConfirmText("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (m: CloseAccountMode) => closeAccount(m),
    onSuccess: () => {
      toast.success(
        mode === "delete" ? "Account deleted" : "Account deactivated",
      );
      useAuthStore.getState().logout();
      navigate("/", { replace: true });
    },
  });

  if (!isOpen) return null;

  const canConfirm =
    mode !== null &&
    confirmText.trim().toUpperCase() === CONFIRM_WORD[mode] &&
    !mutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl text-rose-dark">Close account</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </button>
        </div>

        {/* Step 1: choice */}
        {mode === null && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setMode("deactivate")}
              className="rounded-xl border border-neutral-gray p-4 text-left transition-colors hover:border-rose-dark hover:bg-rose-light"
            >
              <p className="font-body text-sm font-bold text-neutral-dark">
                Deactivate
              </p>
              <p className="mt-1 font-body text-xs text-neutral-charcoal">
                Your data is kept and your account is hidden. There is{" "}
                <strong>no self-service reactivation</strong> - you'll need to
                contact support to reactivate it.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("delete")}
              className="rounded-xl border border-rose-md p-4 text-left transition-colors hover:border-rose-dark hover:bg-rose-light"
            >
              <p className="font-body text-sm font-bold text-rose-dark">
                Permanently delete
              </p>
              <p className="mt-1 font-body text-xs text-neutral-charcoal">
                Your favorites, visits, applications, and profile are removed
                for good. This can't be undone.
              </p>
            </button>
          </div>
        )}

        {/* Step 2: explicit confirmation */}
        {mode !== null && (
          <div className="flex flex-col gap-3">
            <p className="font-body text-sm text-neutral-charcoal">
              {mode === "deactivate" ? (
                <>
                  This deactivates your account. Data is kept, but there's no
                  self-service reactivation - you'll need to contact support to
                  reactivate.
                </>
              ) : (
                <>
                  This permanently deletes your account and all associated data.
                  This can't be undone.
                </>
              )}
            </p>
            <label className="font-body text-xs text-neutral-gray">
              Type <strong>{CONFIRM_WORD[mode]}</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-lg border border-rose-light bg-white px-3 py-1.5 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none"
              autoFocus
            />

            {mutation.isError && (
              <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
                {extractError(mutation.error)}
              </p>
            )}

            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode(null);
                  setConfirmText("");
                }}
                disabled={mutation.isPending}
                className="rounded-xl border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate(mode)}
                disabled={!canConfirm}
                className="rounded-xl bg-rose-dark px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
              >
                {mutation.isPending
                  ? "Working…"
                  : mode === "delete"
                    ? "Delete my account"
                    : "Deactivate my account"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloseAccountModal;
