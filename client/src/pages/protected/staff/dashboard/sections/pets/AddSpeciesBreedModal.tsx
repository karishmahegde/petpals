// AddSpeciesBreedModal.tsx
// "Add species" / "Add breed" dialog, opened from the links beside the
// Species and Breed fields in PetFormPanel — so staff can add a missing
// one without abandoning the pet they're entering. On success it refreshes
// the cached species/breed lists (the pet form, filter bars, and public
// catalog all read the same ["species"] / ["breeds", ...] queries) and
// hands the new ID back so the form can select it straight away.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import Modal, { ModalActions } from "../../../../../../components/ui/Modal";
import {
  createBreed,
  createSpecies,
} from "../../../../../../logic/api/staffPetsApi";

const NAME_MAX = 45; // schema.prisma: speciesName/breedName are VarChar(45)

type AddSpeciesBreedModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
} & (
  | { kind: "species" }
  | { kind: "breed"; speciesID: number; speciesName: string }
);

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AddSpeciesBreedModal = (props: AddSpeciesBreedModalProps) => {
  const { isOpen, onClose, onCreated, kind } = props;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const close = () => {
    setName("");
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () =>
      props.kind === "species"
        ? (await createSpecies(name.trim())).speciesID
        : (await createBreed(props.speciesID, name.trim())).breedID,
    onSuccess: (id) => {
      queryClient.invalidateQueries({
        queryKey: [kind === "species" ? "species" : "breeds"],
      });
      toast.success(kind === "species" ? "Species added" : "Breed added");
      onCreated(id);
      close();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const noun = kind === "species" ? "species" : "breed";

  return (
    <Modal
      isOpen={isOpen}
      title={`Add ${noun}`}
      onClose={close}
      dismissDisabled={mutation.isPending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) mutation.mutate();
        }}
      >
        {props.kind === "breed" && (
          <p className="mb-3 font-body text-sm text-neutral-charcoal">
            Adds a new breed under <strong>{props.speciesName}</strong>.
          </p>
        )}
        <label
          htmlFor="new-species-breed-name"
          className="font-body text-xs text-neutral-gray"
        >
          {kind === "species" ? "Species name" : "Breed name"}
        </label>
        <input
          id="new-species-breed-name"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          disabled={mutation.isPending}
          autoFocus
          className="mt-1 w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark"
        />

        <ModalActions
          cancelLabel="Cancel"
          confirmLabel={`Add ${noun}`}
          onCancel={close}
          onConfirm={() => mutation.mutate()}
          isPending={mutation.isPending}
          confirmDisabled={!name.trim()}
        />
      </form>
    </Modal>
  );
};

export default AddSpeciesBreedModal;
