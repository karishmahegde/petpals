// components/ui/ConfirmActionModal.tsx
// Generic confirmation dialog for a one-off, destructive-ish action (withdraw
// an application, cancel a visit, discard an unsaved form). The caller supplies
// the title, button labels, body copy, and handlers. Same shell as
// CloseAccountModal.
import { FaTimes } from "react-icons/fa";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  /** Primary (destructive) button label. */
  confirmLabel: string;
  /** Dismiss button label. Defaults to "Never mind". */
  cancelLabel?: string;
  /** Disables both buttons and backdrop-dismiss while an async confirm runs. */
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}

const ConfirmActionModal = ({
  isOpen,
  title,
  confirmLabel,
  cancelLabel = "Never mind",
  isPending = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmActionModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={isPending ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl text-rose-dark">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Close"
            className="text-neutral-gray hover:text-neutral-dark disabled:opacity-50"
          >
            <FaTimes />
          </button>
        </div>

        <p className="font-body text-sm text-neutral-charcoal">{children}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-xl bg-red px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:opacity-50"
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
