// CloseAccountModal.tsx
// Mirrors the vet and staff dashboards' CloseAccountModal (same two-step
// choose-then-type-to-confirm flow) — pointed at the volunteer's own
// DELETE /volunteers/me. The backend 409s, in either mode, while the
// volunteer is assisting an upcoming appointment or has an open task;
// that's shown as its own "can't close yet" block (built from
// error.details.blockers) with a way to whichever tab needs attention, not
// as a generic error. On success the session ends via
// logoutDestinationFor — the home page, since volunteers aren't workers.
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
  closeMyVolunteerAccount,
  type CloseAccountBlocker,
  type VolunteerCloseAccountMode,
} from "../../../../../logic/api/volunteersApi";

interface CloseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Word the volunteer must type to enable the action button - avoids a one-click
// destructive action for either mode.
const CONFIRM_WORD: Record<VolunteerCloseAccountMode, string> = {
  deactivate: "DEACTIVATE",
  delete: "DELETE",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

// Same as ModalActions' buttons, for the blocked panel's own row (one
// "View …" button per blocker, which ModalActions can't express).
const actionButton =
  "rounded-xl px-4 py-2 font-body text-sm font-medium transition-colors hover:brightness-95 disabled:opacity-50";

// The 409's blockers, or null for any other outcome.
const openWorkBlockers = (err: unknown): CloseAccountBlocker[] | null => {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return null;
  const blockers = err.response.data?.error?.details?.blockers;
  return Array.isArray(blockers) ? blockers : [];
};

const BLOCKER_COPY: Record<CloseAccountBlocker, { label: string; to: string }> = {
  appointments: { label: "upcoming appointments", to: "/volunteer/appointments" },
  tasks: { label: "open tasks", to: "/volunteer/tasks" },
};

const CloseAccountModal = ({ isOpen, onClose }: CloseAccountModalProps) => {
  const navigate = useNavigate();
  const endSession = useEndSession();
  const [mode, setMode] = useState<VolunteerCloseAccountMode | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const mutation = useMutation({
    mutationFn: (m: VolunteerCloseAccountMode) => closeMyVolunteerAccount(m),
    onSuccess: () => {
      toast.success(
        mode === "delete" ? "Account deleted" : "Account deactivated",
      );
      // Leave and clear the session in one render (see useEndSession).
      endSession(logoutDestinationFor("Volunteer"));
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

  const goTo = (path: string) => {
    handleClose();
    navigate(path);
  };

  const blockers = mutation.isError ? openWorkBlockers(mutation.error) : null;
  const isBlocked = blockers !== null;
  // e.g. "upcoming appointments and open tasks"; an empty list (an older
  // server) still reads sensibly.
  const blockerText =
    blockers && blockers.length > 0
      ? blockers.map((b) => BLOCKER_COPY[b].label).join(" and ")
      : "upcoming appointments or open tasks";

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
                You still have {blockerText}
              </p>
              <p className="mt-1 font-body text-xs text-neutral-charcoal">
                Your account can't be closed while you have work assigned. Ask
                your shelter's staff to reassign it to another volunteer, then
                try again.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <ButtonElement
              onClick={handleClose}
              size="bare"
              className={`${actionButton} bg-red`}
            >
              Close
            </ButtonElement>
            {(blockers ?? []).map((b) => (
              <ButtonElement
                key={b}
                onClick={() => goTo(BLOCKER_COPY[b].to)}
                size="bare"
                className={`${actionButton} bg-teal-dark`}
              >
                View {b}
              </ButtonElement>
            ))}
          </div>
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
              your shelter's staff to reactivate it.
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
              Your volunteer account is removed for good, along with your
              past task and event assignments. This can't be undone.
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
                staff to reactivate it.
              </>
            ) : (
              <>
                This permanently deletes your volunteer account. This can't be
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
