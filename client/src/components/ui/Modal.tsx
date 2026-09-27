// components/ui/Modal.tsx
// The one centered-dialog shell for the whole app — backdrop, white card,
// title row with a close (X) button — plus ModalActions, the standard
// Cancel/Confirm button pair (cancel red, confirm teal). ConfirmActionModal
// and every CloseAccountModal build on these, so dialog styling never drifts
// into per-feature copies. (Slide-overs are SlideOver; the pet/event detail
// sheets are their own layout.)
import { FaTimes } from "react-icons/fa";
import ButtonElement from "./ButtonElement";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  /** Disables the X button and backdrop-dismiss (e.g. while a request runs). */
  dismissDisabled?: boolean;
  children: React.ReactNode;
}

const Modal = ({
  isOpen,
  title,
  onClose,
  dismissDisabled = false,
  children,
}: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={dismissDisabled ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl text-rose-dark">{title}</h2>
          <ButtonElement
            onClick={onClose}
            disabled={dismissDisabled}
            aria-label="Close"
            size="bare"
            variant="outline"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </ButtonElement>
        </div>

        {children}
      </div>
    </div>
  );
};

interface ModalActionsProps {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Disables both buttons and swaps the confirm label for "Working…". */
  isPending?: boolean;
  /** Disables only the confirm button (e.g. until a required input is filled). */
  confirmDisabled?: boolean;
}

const actionButton =
  "rounded-xl px-4 py-2 font-body text-sm font-medium transition-colors hover:brightness-95 disabled:opacity-50";

export const ModalActions = ({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  isPending = false,
  confirmDisabled = false,
}: ModalActionsProps) => (
  <div className="mt-5 flex justify-end gap-3">
    <ButtonElement
      onClick={onCancel}
      disabled={isPending}
      size="bare"
      className={`${actionButton} bg-red`}
    >
      {cancelLabel}
    </ButtonElement>
    <ButtonElement
      onClick={onConfirm}
      disabled={isPending || confirmDisabled}
      size="bare"
      className={`${actionButton} bg-teal-dark`}
    >
      {isPending ? "Working…" : confirmLabel}
    </ButtonElement>
  </div>
);

export default Modal;
