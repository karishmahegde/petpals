// CancelApplicationModal.tsx
// Confirmation shown only when the adoption application form has unsaved
// input — discarding navigates back, declining just closes the modal (form
// state is untouched since the page never left).
import { FaTimes } from "react-icons/fa";

interface CancelApplicationModalProps {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

const CancelApplicationModal = ({
  isOpen,
  onKeepEditing,
  onDiscard,
}: CancelApplicationModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onKeepEditing}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl text-rose-dark">
            Cancel application?
          </h2>
          <button
            type="button"
            onClick={onKeepEditing}
            aria-label="Close"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </button>
        </div>

        <p className="font-body text-sm text-neutral-charcoal">
          Are you sure you want to cancel? Your application hasn't been
          submitted.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onKeepEditing}
            className="rounded-xl border border-neutral-gray px-4 py-2 font-body text-sm font-medium text-neutral-dark transition-colors hover:bg-neutral-lightgray"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-xl bg-rose-dark px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelApplicationModal;
