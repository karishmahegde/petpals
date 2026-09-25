// TransferFormPanel.tsx
// "Initiate a transfer" form — reachable two ways: the Pets edit panel's
// link (?petID= deep link into Transfers.tsx, same pattern as Applications'
// ?applicationID=), which pre-selects the pet; and the Transfers tab's own
// "Initiate Transfer" button, which opens with no pet and shows a Pet picker
// first. Only a pet currently "available" may be transferred (mirrors the
// backend's own 409 guard, but checked client-side first so staff get
// immediate feedback without a round trip) — the picker lists only those.
// Assigned staff on both sides are shown read-only: From = the logged-in
// staff member, To = the destination shelter's manager (only that manager
// may reassign it later, from TransferDetailPanel).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { getShelters } from "../../../../../../logic/api/petsApi";
import {
  getMyShelterPets,
  getShelterPetDetail,
} from "../../../../../../logic/api/staffPetsApi";
import {
  getTransferAssignees,
  initiateTransfer,
} from "../../../../../../logic/api/transfersApi";

interface TransferFormPanelProps {
  open: boolean;
  /** Pre-selected pet (Pets-tab entry). null → show the Pet picker. */
  presetPetID: number | null;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark disabled:opacity-50";
const readOnlyFieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-neutral-offwhite px-3 py-2.5 font-body text-sm text-neutral-gray focus:outline-none";
const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

const MAX_REASON_LEN = 300; // schema.prisma: transferReason is VarChar(300)

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const TransferFormPanel = ({
  open,
  presetPetID,
  onClose,
}: TransferFormPanelProps) => {
  const queryClient = useQueryClient();
  const [pickedPetID, setPickedPetID] = useState("");
  const [destinationShelterID, setDestinationShelterID] = useState("");
  const [reason, setReason] = useState("");
  const showPetPicker = presetPetID === null;
  const petID = presetPetID ?? (pickedPetID ? Number(pickedPetID) : null);

  const { data: availablePetsResult } = useQuery({
    queryKey: ["staff", "shelter-pets", "for-transfer"],
    queryFn: () => getMyShelterPets({ adoptionStatus: "available", limit: 200 }),
    enabled: open && showPetPicker,
  });
  const availablePets = availablePetsResult?.data ?? [];

  const { data: pet, isLoading, isError } = useQuery({
    queryKey: ["staff", "pet-detail", petID],
    queryFn: () => getShelterPetDetail(petID!),
    enabled: open && petID !== null,
  });

  const { data: shelters = [] } = useQuery({
    queryKey: ["shelters"],
    queryFn: getShelters,
    enabled: open,
  });

  const { data: assignees } = useQuery({
    queryKey: ["staff", "transfer-assignees", destinationShelterID],
    queryFn: () =>
      getTransferAssignees(
        destinationShelterID ? Number(destinationShelterID) : undefined,
      ),
    enabled: open,
  });

  const toStaffDisplay = !destinationShelterID
    ? "Select a destination shelter"
    : (assignees?.toShelterStaff?.staffName ?? "No manager assigned");

  const destinationOptions = shelters.filter(
    (shelter) => shelter.shelterID !== pet?.shelter.shelterID,
  );

  const resetForm = () => {
    setPickedPetID("");
    setDestinationShelterID("");
    setReason("");
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  const submit = useMutation({
    mutationFn: () =>
      initiateTransfer({
        petID: petID!,
        toShelterID: Number(destinationShelterID),
        transferReason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "transfers-queue"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "pet-detail", petID] });
      toast.success("Transfer initiated");
      closeAndReset();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const isPetAvailable = pet?.adoptionStatus === "available";
  const canSubmit =
    destinationShelterID !== "" &&
    reason.trim() !== "" &&
    reason.length <= MAX_REASON_LEN &&
    isPetAvailable &&
    !submit.isPending;

  return (
    <SlideOver open={open} onClose={closeAndReset} title="Initiate Transfer">
      {showPetPicker && (
        <div className={pet ? "px-6 pt-6" : "p-6"}>
          <label className={labelClass} htmlFor="transfer-pet">
            Pet
          </label>
          <select
            id="transfer-pet"
            required
            value={pickedPetID}
            onChange={(e) => {
              setPickedPetID(e.target.value);
              setDestinationShelterID("");
            }}
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {availablePets.map((availablePet) => (
              <option key={availablePet.petID} value={availablePet.petID}>
                {availablePet.petName}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <p className="p-6 font-body text-sm text-neutral-gray">
          Loading pet…
        </p>
      )}
      {isError && (
        <p className="p-6 font-body text-sm text-rose-dark">
          Couldn't load this pet. Please try again.
        </p>
      )}

      {pet && (
        <div className="p-6">
          <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
            {pet.petPhoto ? (
              <img
                src={pet.petPhoto}
                alt={`${pet.petName} photo`}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                <FaPaw className="h-6 w-6 text-rose-md" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-body font-bold text-neutral-charcoal">
                {pet.petName}
              </p>
              <p className="truncate text-xs text-neutral-gray">
                Currently at {pet.shelter.shelterName}
              </p>
            </div>
          </div>

          {!isPetAvailable && (
            <div className="mt-5 rounded-xl bg-rose-lightest p-3 font-body text-xs text-rose-dark">
              {pet.petName} isn't currently available for transfer (status:{" "}
              {pet.adoptionStatus}).
            </div>
          )}

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) submit.mutate();
            }}
          >
            <div>
              <label className={labelClass} htmlFor="transfer-destination">
                Destination shelter
              </label>
              <select
                id="transfer-destination"
                required
                disabled={!isPetAvailable}
                value={destinationShelterID}
                onChange={(e) => setDestinationShelterID(e.target.value)}
                className={fieldClass}
              >
                <option value="">- Select -</option>
                {destinationOptions.map((shelter) => (
                  <option key={shelter.shelterID} value={shelter.shelterID}>
                    {shelter.shelterName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="transfer-from-staff">
                  From shelter staff
                </label>
                <input
                  id="transfer-from-staff"
                  readOnly
                  value={assignees?.fromShelterStaff?.staffName ?? "—"}
                  className={readOnlyFieldClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="transfer-to-staff">
                  To shelter staff
                </label>
                <input
                  id="transfer-to-staff"
                  readOnly
                  value={toStaffDisplay}
                  className={readOnlyFieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="transfer-reason">
                Reason for transfer
              </label>
              <textarea
                id="transfer-reason"
                required
                rows={3}
                maxLength={MAX_REASON_LEN}
                disabled={!isPetAvailable}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={fieldClass}
              />
            </div>

            <ButtonElement
              type="submit"
              disabled={!canSubmit}
              size="panel"
              className="w-full bg-teal-dark hover:brightness-95 disabled:cursor-not-allowed"
            >
              {submit.isPending ? "Submitting…" : "Submit request"}
            </ButtonElement>
          </form>
        </div>
      )}
    </SlideOver>
  );
};

export default TransferFormPanel;
