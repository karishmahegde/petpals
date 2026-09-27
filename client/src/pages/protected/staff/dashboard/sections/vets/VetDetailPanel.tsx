// VetDetailPanel.tsx
// "Vet Details" slide-over for the shelter manager — opened from an All
// Vets row's "View Details". The row already carries every field, so
// there's no refetch. Same identity banner + InfoRow layout as the Staff
// tab's StaffDetailPanel. Everything is read-only (each vet edits their own
// details); the footer offers Deactivate Vet (behind a ConfirmActionModal)
// while the vet is Active.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import { formatFullDate } from "../../../../../../logic/utils/datetime";
import {
  updateShelterVetStatus,
  type ShelterVet,
  type VetAccountStatus,
} from "../../../../../../logic/api/shelterVetsApi";
import { formatVetName } from "../../../../../../logic/utils/vetName";
import { formatAddress } from "../../../../../../logic/utils/address";

interface VetDetailPanelProps {
  vet: ShelterVet | null;
  onClose: () => void;
}

const STATUS_TONE: Record<VetAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

const SEX_LABEL: Record<"M" | "F", string> = { M: "Male", F: "Female" };

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const formatDate = (date: string | null) =>
  date ? formatFullDate(new Date(date)) : "—";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const VetDetailPanel = ({ vet, onClose }: VetDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const deactivate = useMutation({
    mutationFn: () => updateShelterVetStatus(vet!.userID, "Deactivated"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "vets"] });
      toast.success("Veterinarian deactivated");
      setConfirmingDeactivate(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <>
      <SlideOver
        open={vet !== null}
        onClose={onClose}
        title="Vet Details"
        footer={
          vet?.accountStatus === "Active" ? (
            <ButtonElement
              onClick={() => setConfirmingDeactivate(true)}
              size="panel"
              className="w-full bg-red hover:brightness-95"
            >
              Deactivate Vet
            </ButtonElement>
          ) : undefined
        }
      >
        {vet && (
          <div className="p-6">
            {/* Identity summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              <Avatar
                seed={vet.avatarSeed}
                alt={`${vet.vetName} avatar`}
                size={56}
                className="h-14 w-14 shrink-0 rounded-full ring-2 ring-teal-dark"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {formatVetName(vet.vetName)}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  Veterinarian
                </p>
              </div>
              <Badge tone={STATUS_TONE[vet.accountStatus]}>
                {vet.accountStatus}
              </Badge>
            </div>

            <dl className="mt-5 grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-2">
              <InfoRow k="Email" v={vet.vetEmail} />
              <InfoRow
                k="Phone"
                v={vet.vetPhone ? <PhoneDisplay value={vet.vetPhone} /> : "—"}
              />
              <InfoRow k="Date of Birth" v={formatDate(vet.vetDOB)} />
              <InfoRow k="Sex" v={vet.vetSex ? SEX_LABEL[vet.vetSex] : "—"} />
              <InfoRow k="Address" v={formatAddress(vet) || "—"} />
              <InfoRow k="Registered on" v={formatDate(vet.createdAt)} />
            </dl>
          </div>
        )}
      </SlideOver>

      {vet && (
        <ConfirmActionModal
          isOpen={confirmingDeactivate}
          title="Deactivate this veterinarian?"
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          isPending={deactivate.isPending}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => deactivate.mutate()}
        >
          This deactivates {formatVetName(vet.vetName)}'s account. They won't be able to log
          in.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default VetDetailPanel;
