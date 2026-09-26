// components/ui/ConfirmActionModal.tsx
// Generic confirmation dialog for a one-off, destructive-ish action (withdraw
// an application, cancel a visit, discard an unsaved form). The caller supplies
// the title, button labels, body copy, and handlers. Shell and buttons come
// from Modal/ModalActions, same as CloseAccountModal.
import Modal, { ModalActions } from "./Modal";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  /** Primary (confirm) button label. */
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
}: ConfirmActionModalProps) => (
  <Modal
    isOpen={isOpen}
    title={title}
    onClose={onCancel}
    dismissDisabled={isPending}
  >
    <div className="font-body text-sm text-neutral-charcoal">{children}</div>

    <ModalActions
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  </Modal>
);

export default ConfirmActionModal;
