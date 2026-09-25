// TransferDetailPanel.tsx
// Detail slide-over for one inter-shelter transfer — opened from a
// Transfers row's "View Details". Mirrors the staff Applications section's
// own ApplicationDetailPanel (same pet-summary banner, same info-row
// layout, same per-action ConfirmActionModal), with one difference:
// Approve/Decline vs. Cancel are asymmetric (only the destination shelter
// may Approve/Decline, only the origin shelter may Cancel), and the client
// has no shelterID to infer which side it's on — so the caller (Transfers.tsx)
// tells this panel explicitly via `viewAs`, based on which list the row came
// from. Assigned staff (From/To) are read-only, except that the destination
// shelter's manager may reassign To staff on an incoming, In_Progress
// transfer (server-computed canReassignToShelterStaff).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import {
  getTransferById,
  reassignTransferStaff,
  reviewTransfer,
  type TransferReviewStatus,
} from "../../../../../../logic/api/transfersApi";
import { getShelterStaff } from "../../../../../../logic/api/staffAppointmentsApi";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

interface TransferDetailPanelProps {
  transferID: number | null;
  viewAs: "incoming" | "outgoing";
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  In_Progress: "In Progress",
  Completed: "Completed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  In_Progress: "gold",
  Completed: "green",
  Rejected: "red",
  Cancelled: "gray",
};

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading = "mt-4 font-body text-sm font-semibold text-neutral-dark";
const quoteBlock = "mt-1 font-body text-sm italic text-neutral-charcoal";
const divider = "my-5 border-t border-neutral-lightgray";
const selectClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-1.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark disabled:opacity-50";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const TransferDetailPanel = ({
  transferID,
  viewAs,
  onClose,
}: TransferDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] =
    useState<TransferReviewStatus | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "transfer", transferID],
    queryFn: () => getTransferById(transferID!),
    enabled: transferID !== null,
  });

  const canReassign =
    viewAs === "incoming" && data?.canReassignToShelterStaff === true;

  // Incoming → the destination is this staff member's own shelter, which is
  // exactly what /appointments/staff is scoped to.
  const { data: shelterStaff = [] } = useQuery({
    queryKey: ["staff", "shelter-staff"],
    queryFn: getShelterStaff,
    enabled: canReassign,
  });

  const reassign = useMutation({
    mutationFn: (staffID: number) =>
      reassignTransferStaff(transferID!, staffID),
    onSuccess: (updated) => {
      queryClient.setQueryData(["staff", "transfer", transferID], updated);
      toast.success("Transfer staff reassigned");
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const review = useMutation({
    mutationFn: (status: TransferReviewStatus) =>
      reviewTransfer(transferID!, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "transfers-queue"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "shelter-pets"] });
      queryClient.invalidateQueries({
        queryKey: ["staff", "transfer", transferID],
      });
      toast.success(
        status === "Completed"
          ? "Transfer approved"
          : status === "Rejected"
            ? "Transfer declined"
            : "Transfer cancelled",
      );
      setPendingAction(null);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const showActions = data?.transferStatus === "In_Progress";

  return (
    <>
      <SlideOver
        open={transferID !== null}
        onClose={onClose}
        title="Transfer Details"
        footer={
          showActions ? (
            viewAs === "incoming" ? (
              <div className="flex gap-3">
                <ButtonElement
                  onClick={() => setPendingAction("Rejected")}
                  size="panel"
                  variant="outline"
                  className="flex-1 border border-rose-dark text-rose-dark hover:bg-rose-dark hover:text-white"
                >
                  Decline
                </ButtonElement>
                <ButtonElement
                  onClick={() => setPendingAction("Completed")}
                  size="panel"
                  className="flex-1 bg-green hover:brightness-95"
                >
                  Approve
                </ButtonElement>
              </div>
            ) : (
              <ButtonElement
                onClick={() => setPendingAction("Cancelled")}
                size="panel"
                variant="outline"
                className="w-full border bg-red text-white hover:brightness-95"
              >
                Cancel Transfer
              </ButtonElement>
            )
          ) : undefined
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading transfer…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this transfer. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Pet summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {data.pet.petPhoto ? (
                <img
                  src={data.pet.petPhoto}
                  alt={`${data.pet.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.pet.petName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.pet.breedName} · {data.pet.speciesName}
                </p>
              </div>
            </div>

            {/* Pet details */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Age" v={data.pet.petAge} />
              <InfoRow k="Sex" v={data.pet.petSex} />
              <InfoRow k="Color" v={data.pet.petColor} />
            </dl>

            {/* Transfer info */}
            <div className={divider} />
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="From" v={data.fromShelter.shelterName} />
              <InfoRow k="To" v={data.toShelter.shelterName} />
              <InfoRow
                k="From staff"
                v={data.fromStaff?.staffName ?? "Unassigned"}
              />
              {canReassign ? (
                <>
                  <dt className={label}>
                    <label htmlFor="transfer-to-staff">To staff</label>
                  </dt>
                  <dd>
                    <select
                      id="transfer-to-staff"
                      value={data.toShelterStaff ?? ""}
                      disabled={reassign.isPending}
                      onChange={(e) => reassign.mutate(Number(e.target.value))}
                      className={selectClass}
                    >
                      {data.toShelterStaff === null && (
                        <option value="" disabled>
                          - Select -
                        </option>
                      )}
                      {shelterStaff.map((member) => (
                        <option key={member.staffID} value={member.staffID}>
                          {member.staffName}
                        </option>
                      ))}
                    </select>
                  </dd>
                </>
              ) : (
                <InfoRow
                  k="To staff"
                  v={data.toStaff?.staffName ?? "Unassigned"}
                />
              )}
              <InfoRow
                k="Date"
                v={formatFullDate(new Date(data.transferDate))}
              />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[data.transferStatus]}>
                  {STATUS_LABEL[data.transferStatus]}
                </Badge>
              </dd>
            </dl>

            {/* Reason */}
            <div className={divider} />
            <h3 className={sectionHeading}>Transfer Reason</h3>
            <p className={quoteBlock}>"{data.transferReason}"</p>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={pendingAction !== null}
        title={
          pendingAction === "Completed"
            ? "Approve this transfer?"
            : pendingAction === "Rejected"
              ? "Decline this transfer?"
              : "Cancel this transfer?"
        }
        confirmLabel={
          pendingAction === "Completed"
            ? "Approve"
            : pendingAction === "Rejected"
              ? "Decline"
              : "Cancel Transfer"
        }
        isPending={review.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && review.mutate(pendingAction)}
      >
        {data && (
          <p>
            {pendingAction === "Completed" ? (
              <>
                This moves <strong>{data.pet.petName}</strong> to{" "}
                {data.toShelter.shelterName} and marks it available there.
              </>
            ) : pendingAction === "Rejected" ? (
              <>
                This keeps <strong>{data.pet.petName}</strong> at{" "}
                {data.fromShelter.shelterName} and marks it available again.
              </>
            ) : (
              <>
                This retracts the transfer request for{" "}
                <strong>{data.pet.petName}</strong> and marks it available again
                at {data.fromShelter.shelterName}.
              </>
            )}
          </p>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default TransferDetailPanel;
