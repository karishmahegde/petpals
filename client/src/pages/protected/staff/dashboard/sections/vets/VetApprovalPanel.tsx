// VetApprovalPanel.tsx
// "Vet Approval" slide-over for the shelter manager — opened from a Vet
// Approvals row's "View Details". Mirrors the Staff tab's
// StaffApprovalPanel: the Pending vet's full profile (what they filled in
// during onboarding) plus what approval is waiting on, with Approve and
// Decline in the footer. The row already carries every field, so there's no
// refetch.
// Approving needs their onboarding complete AND their government ID
// Verified (the server refuses otherwise). Approve stays disabled, with the
// reason shown, until both are in place — vets have no designation to pick.
// If the state changed since the list loaded (say the ID was rejected in
// the meantime), the server's 409 message comes back as the toast. Decline
// goes behind a confirmation.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import { formatFullDate } from "../../../../../../logic/utils/datetime";
import { formatAddress } from "../../../../../../logic/utils/address";
import { formatVetName } from "../../../../../../logic/utils/vetName";
import { approvalBlockers } from "../../../../../../logic/staff/approvalReadiness";
import {
  updateShelterVetStatus,
  type ShelterVet,
} from "../../../../../../logic/api/shelterVetsApi";

interface VetApprovalPanelProps {
  vet: ShelterVet | null;
  onClose: () => void;
}

const SEX_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";

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

const VetApprovalPanel = ({ vet, onClose }: VetApprovalPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  const refreshVets = () =>
    queryClient.invalidateQueries({ queryKey: ["staff", "vets"] });

  const approve = useMutation({
    mutationFn: () => updateShelterVetStatus(vet!.userID, "Active"),
    onSuccess: () => {
      refreshVets();
      toast.success("Veterinarian approved");
      onClose();
    },
    // A 409 here means the readiness changed after the list loaded — show
    // the server's reason and refetch so the row catches up.
    onError: (err) => {
      toast.error(extractError(err));
      refreshVets();
    },
  });

  const decline = useMutation({
    mutationFn: () => updateShelterVetStatus(vet!.userID, "Deactivated"),
    onSuccess: () => {
      refreshVets();
      toast.success("Veterinarian declined");
      setConfirmingDecline(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const blockers = vet ? approvalBlockers(vet) : [];
  const busy = approve.isPending || decline.isPending;
  const canApprove = blockers.length === 0 && !busy;

  return (
    <>
      <SlideOver
        open={vet !== null}
        onClose={onClose}
        title="Vet Approval"
        footer={
          vet && (
            <div className="flex gap-3">
              <ButtonElement
                onClick={() => approve.mutate()}
                disabled={!canApprove}
                size="panel"
                className="flex-1 bg-green hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approve.isPending ? "Approving…" : "Approve"}
              </ButtonElement>
              <ButtonElement
                onClick={() => setConfirmingDecline(true)}
                disabled={busy}
                size="panel"
                className="flex-1 bg-red hover:brightness-95 disabled:cursor-not-allowed"
              >
                Decline
              </ButtonElement>
            </div>
          )
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
                  Awaiting approval
                </p>
              </div>
              <Badge tone="gold">Pending</Badge>
            </div>

            <dl className="mt-5 grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-2">
              <InfoRow k="Email" v={vet.vetEmail} />
              <InfoRow
                k="Phone"
                v={vet.vetPhone ? <PhoneDisplay value={vet.vetPhone} /> : "—"}
              />
              <InfoRow
                k="Date of Birth"
                v={vet.vetDOB ? formatFullDate(new Date(vet.vetDOB)) : "—"}
              />
              <InfoRow
                k="Sex"
                v={vet.vetSex ? (SEX_LABEL[vet.vetSex] ?? vet.vetSex) : "—"}
              />
              <InfoRow k="Address" v={formatAddress(vet) || "—"} />
              <InfoRow
                k="Onboarding"
                v={vet.onboardingComplete ? "Complete" : "Not finished"}
              />
              <InfoRow
                k="Government ID"
                v={
                  <span className="flex flex-wrap items-center gap-x-3">
                    {vet.governmentIdStatus ?? "Not submitted"}
                    {vet.governmentIdStatus === "Pending" && (
                      <ButtonElement
                        to="/staff/id-verification"
                        size="bare"
                        variant="outline"
                        className="text-sm font-medium text-teal-dark underline"
                      >
                        Verify ID
                      </ButtonElement>
                    )}
                  </span>
                }
              />
            </dl>

            {blockers.length > 0 ? (
              <div className="mt-5 rounded-lg bg-gold-lightest px-4 py-3 font-body text-sm text-neutral-charcoal">
                <p className="font-semibold">Can't approve yet</p>
                <p className="mt-1">{blockers.join(" · ")}</p>
              </div>
            ) : (
              <p className="mt-5 font-body text-xs text-neutral-gray">
                Onboarding is done and their ID is verified. Approving
                activates their account at your shelter.
              </p>
            )}
          </div>
        )}
      </SlideOver>

      {vet && (
        <ConfirmActionModal
          isOpen={confirmingDecline}
          title="Decline this veterinarian?"
          confirmLabel="Decline"
          cancelLabel="Cancel"
          isPending={decline.isPending}
          onCancel={() => setConfirmingDecline(false)}
          onConfirm={() => decline.mutate()}
        >
          This declines {formatVetName(vet.vetName)}'s registration and
          deactivates their account.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default VetApprovalPanel;
