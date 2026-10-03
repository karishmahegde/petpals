// AddHealthRecordModal.tsx
// The Health Passport's "Add Record" dialog — a vet's standalone health note
// for the pet (POST /pets/:id/health-records). Vet-only: HealthPassport only
// renders the button for the Veterinarian role. On success the passport's
// own query is invalidated so the new record shows at the top.
import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import Modal, { ModalActions } from "../../../components/ui/Modal";
import { createMyVetHealthRecord } from "../../../logic/api/vetsApi";

const MAX_DESC_LEN = 500;

interface AddHealthRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  petID: number;
  petName: string;
  /** The passport query to refresh once the record is saved. */
  passportQueryKey: QueryKey;
}

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AddHealthRecordModal = ({
  isOpen,
  onClose,
  petID,
  petName,
  passportQueryKey,
}: AddHealthRecordModalProps) => {
  const queryClient = useQueryClient();
  const [recordDesc, setRecordDesc] = useState("");

  const mutation = useMutation({
    mutationFn: (desc: string) => createMyVetHealthRecord(petID, desc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passportQueryKey });
      toast.success("Health record added");
      handleClose();
    },
  });

  const handleClose = () => {
    setRecordDesc("");
    mutation.reset();
    onClose();
  };

  const trimmed = recordDesc.trim();

  return (
    <Modal
      isOpen={isOpen}
      title="Add Health Record"
      onClose={handleClose}
      dismissDisabled={mutation.isPending}
    >
      <div className="flex flex-col gap-3">
        <label
          htmlFor="health-record-desc"
          className="font-body text-xs text-neutral-gray"
        >
          Notes for {petName} — one finding per line shows as a bullet list
        </label>
        <textarea
          id="health-record-desc"
          value={recordDesc}
          maxLength={MAX_DESC_LEN}
          rows={5}
          onChange={(e) => setRecordDesc(e.target.value)}
          placeholder="e.g. Weight loss observed."
          className="w-full resize-none rounded-lg border border-rose-light bg-white px-3 py-2 font-body text-sm text-neutral-dark placeholder:italic placeholder:text-neutral-gray focus:border-teal-dark focus:outline-none"
          autoFocus
        />
        <p className="text-right font-body text-xs text-neutral-gray">
          {recordDesc.length}/{MAX_DESC_LEN}
        </p>

        {mutation.isError && (
          <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
            {extractError(mutation.error)}
          </p>
        )}

        <ModalActions
          cancelLabel="Cancel"
          confirmLabel="Save record"
          onCancel={handleClose}
          onConfirm={() => mutation.mutate(trimmed)}
          isPending={mutation.isPending}
          confirmDisabled={trimmed === ""}
        />
      </div>
    </Modal>
  );
};

export default AddHealthRecordModal;
