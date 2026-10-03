// CloseAccountModal.tsx
// Mirrors the other roles' CloseAccountModal (same two-step
// choose-then-type-to-confirm flow) — pointed at the donor's own
// DELETE /donors/me. Unlike the vet's and volunteer's, nothing blocks it
// (no 409 panel). On success the session ends via useEndSession on
// logoutDestinationFor("Donor") — the home page, like Log out.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import useEndSession from "../../../../../logic/hooks/useEndSession";
import { logoutDestinationFor } from "../../../../../logic/route/resolveDestination";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import Modal, { ModalActions } from "../../../../../components/ui/Modal";
import {
  closeMyDonorAccount,
  type DonorCloseAccountMode,
} from "../../../../../logic/api/donorsApi";

interface CloseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Word the donor must type to enable the action button - avoids a one-click
// destructive action for either mode.
const CONFIRM_WORD: Record<DonorCloseAccountMode, string> = {
  deactivate: "DEACTIVATE",
  delete: "DELETE",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const CloseAccountModal = ({ isOpen, onClose }: CloseAccountModalProps) => {
  const endSession = useEndSession();
  const [mode, setMode] = useState<DonorCloseAccountMode | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const mutation = useMutation({
    mutationFn: (m: DonorCloseAccountMode) => closeMyDonorAccount(m),
    onSuccess: () => {
      toast.success(
        mode === "delete" ? "Account deleted" : "Account deactivated",
      );
      // Leave and clear the session in one render (see useEndSession).
      endSession(logoutDestinationFor("Donor"));
    },
  });

  const reset = () => {
    setMode(null);
    setConfirmText("");
    mutation.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canConfirm =
    mode !== null &&
    confirmText.trim().toUpperCase() === CONFIRM_WORD[mode] &&
    !mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      title="Close account"
      onClose={handleClose}
      dismissDisabled={mutation.isPending}
    >
      {/* Step 1: choice */}
      {mode === null && (
        <div className="flex flex-col gap-3">
          <ButtonElement
            onClick={() => setMode("deactivate")}
            size="bare"
            variant="outline"
            className="rounded-xl border border-neutral-gray p-4 text-left hover:border-rose-dark hover:bg-rose-light"
          >
            <p className="font-body text-sm font-bold text-neutral-dark">
              Deactivate
            </p>
            <p className="mt-1 font-body text-xs text-neutral-charcoal">
              Your data is kept and your account is hidden. There is{" "}
              <strong>no self-service reactivation</strong> - you'll need to
              contact PetPals to reactivate it.
            </p>
          </ButtonElement>
          <ButtonElement
            onClick={() => setMode("delete")}
            size="bare"
            variant="outline"
            className="rounded-xl border border-rose-md p-4 text-left hover:border-rose-dark hover:bg-rose-light"
          >
            <p className="font-body text-sm font-bold text-rose-dark">
              Permanently delete
            </p>
            <p className="mt-1 font-body text-xs text-neutral-charcoal">
              Your donor account is removed for good. Your past donations
              stay on each shelter's records. This can't be undone.
            </p>
          </ButtonElement>
        </div>
      )}

      {/* Step 2: explicit confirmation */}
      {mode !== null && (
        <div className="flex flex-col gap-3">
          <p className="font-body text-sm text-neutral-charcoal">
            {mode === "deactivate" ? (
              <>
                This deactivates your account. Data is kept, but there's no
                self-service reactivation - you'll need to contact PetPals to
                reactivate it.
              </>
            ) : (
              <>
                This permanently deletes your donor account. This can't be
                undone.
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

          <ModalActions
            cancelLabel="Back"
            confirmLabel={
              mode === "delete" ? "Delete my account" : "Deactivate my account"
            }
            onCancel={reset}
            onConfirm={() => mutation.mutate(mode)}
            isPending={mutation.isPending}
            confirmDisabled={!canConfirm}
          />
        </div>
      )}
    </Modal>
  );
};

export default CloseAccountModal;
