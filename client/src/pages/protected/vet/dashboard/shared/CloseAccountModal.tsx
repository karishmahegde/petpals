// CloseAccountModal.tsx
// Mirrors the staff dashboard's CloseAccountModal (same two-step
// choose-then-type-to-confirm flow) — pointed at the vet's own
// DELETE /vets/me. The backend 409s, in either mode, while the vet still has
// upcoming Scheduled appointments; that's shown as its own "can't close
// yet" block with a way to the Appointments tab, not as a generic error.
// On success the session ends on the worker login (logoutDestinationFor).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { PiCalendarX } from "react-icons/pi";
import useEndSession from "../../../../../logic/hooks/useEndSession";
import { logoutDestinationFor } from "../../../../../logic/route/resolveDestination";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import Modal, { ModalActions } from "../../../../../components/ui/Modal";
import {
  closeMyVetAccount,
  type VetCloseAccountMode,
} from "../../../../../logic/api/vetsApi";

interface CloseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Word the vet must type to enable the action button - avoids a one-click
// destructive action for either mode.
const CONFIRM_WORD: Record<VetCloseAccountMode, string> = {
  deactivate: "DEACTIVATE",
  delete: "DELETE",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const isUpcomingAppointmentsBlock = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 409;

const CloseAccountModal = ({ isOpen, onClose }: CloseAccountModalProps) => {
  const navigate = useNavigate();
  const endSession = useEndSession();
  const [mode, setMode] = useState<VetCloseAccountMode | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const mutation = useMutation({
    mutationFn: (m: VetCloseAccountMode) => closeMyVetAccount(m),
    onSuccess: () => {
      toast.success(
        mode === "delete" ? "Account deleted" : "Account deactivated",
      );
      // Leave and clear the session in one render (see useEndSession).
      endSession(logoutDestinationFor("Veterinarian"));
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

  const goToAppointments = () => {
    handleClose();
    navigate("/vet/appointments");
  };

  const isBlocked = mutation.isError && isUpcomingAppointmentsBlock(mutation.error);

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
      {/* Blocked: upcoming appointments (409) */}
      {isBlocked && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl bg-gold-lightest p-4">
            <PiCalendarX
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-dark"
              aria-hidden
            />
            <div>
              <p className="font-body text-sm font-bold text-neutral-dark">
                You still have upcoming appointments
              </p>
              <p className="mt-1 font-body text-xs text-neutral-charcoal">
                Your account can't be closed while appointments are booked
                with you. Ask your shelter's staff to reassign them to another
                vet, then try again.
              </p>
            </div>
          </div>
          <ModalActions
            cancelLabel="Close"
            confirmLabel="View appointments"
            onCancel={handleClose}
            onConfirm={goToAppointments}
          />
        </div>
      )}

      {/* Step 1: choice */}
      {!isBlocked && mode === null && (
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
              <strong>no self-service reactivation</strong> - you'll need
              your shelter's manager to reactivate it.
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
              Your vet account is removed for good. The health records and
              vaccinations you wrote stay on each pet's passport. This can't
              be undone.
            </p>
          </ButtonElement>
        </div>
      )}

      {/* Step 2: explicit confirmation */}
      {!isBlocked && mode !== null && (
        <div className="flex flex-col gap-3">
          <p className="font-body text-sm text-neutral-charcoal">
            {mode === "deactivate" ? (
              <>
                This deactivates your account. Data is kept, but there's no
                self-service reactivation - you'll need your shelter's
                manager to reactivate it.
              </>
            ) : (
              <>
                This permanently deletes your vet account. This can't be
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
