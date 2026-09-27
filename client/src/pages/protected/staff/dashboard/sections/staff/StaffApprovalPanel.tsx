// StaffApprovalPanel.tsx
// "Staff Approval" slide-over for the shelter manager — opened from a Staff
// Approvals row's "View Details". Shows the Pending member's full profile
// (what they filled in during onboarding) plus what approval is waiting on,
// with Approve and Decline in the footer. The row already carries every
// field, so there's no refetch; the caller remounts this per member via
// `key`.
// Approving needs their onboarding complete AND their government ID
// Verified (the server refuses otherwise), and a designation — staff sign
// up without one. Approve stays disabled, with the reason shown, until all
// three are in place. Decline goes behind a confirmation.
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
import { approvalBlockers } from "../../../../../../logic/staff/approvalReadiness";
import {
  updateShelterStaffStatus,
  type AssignableDesignation,
  type ShelterStaffMember,
} from "../../../../../../logic/api/shelterStaffApi";

interface StaffApprovalPanelProps {
  member: ShelterStaffMember | null;
  onClose: () => void;
}

const DESIGNATIONS: AssignableDesignation[] = ["Senior", "Associate"];

const SEX_LABEL: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const selectClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-1.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

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

const StaffApprovalPanel = ({ member, onClose }: StaffApprovalPanelProps) => {
  const queryClient = useQueryClient();
  const [designation, setDesignation] = useState<AssignableDesignation | "">("");
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  const refreshStaff = () =>
    queryClient.invalidateQueries({ queryKey: ["staff", "staff-members"] });

  const approve = useMutation({
    mutationFn: () =>
      updateShelterStaffStatus(
        member!.userID,
        "Active",
        designation as AssignableDesignation,
      ),
    onSuccess: () => {
      refreshStaff();
      toast.success("Staff member approved");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const decline = useMutation({
    mutationFn: () => updateShelterStaffStatus(member!.userID, "Deactivated"),
    onSuccess: () => {
      refreshStaff();
      toast.success("Staff member declined");
      setConfirmingDecline(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const blockers = member ? approvalBlockers(member) : [];
  const busy = approve.isPending || decline.isPending;
  const canApprove = blockers.length === 0 && designation !== "" && !busy;

  return (
    <>
      <SlideOver
        open={member !== null}
        onClose={onClose}
        title="Staff Approval"
        footer={
          member && (
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
        {member && (
          <div className="p-6">
            {/* Identity summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              <Avatar
                seed={member.avatarSeed}
                alt={`${member.staffName} avatar`}
                size={56}
                className="h-14 w-14 shrink-0 rounded-full ring-2 ring-teal-dark"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {member.staffName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  Awaiting approval
                </p>
              </div>
              <Badge tone="gold">Pending</Badge>
            </div>

            <dl className="mt-5 grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-2">
              <InfoRow k="Email" v={member.staffEmail} />
              <InfoRow
                k="Phone"
                v={
                  member.staffPhone ? (
                    <PhoneDisplay value={member.staffPhone} />
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                k="Date of Birth"
                v={
                  member.staffDOB
                    ? formatFullDate(new Date(member.staffDOB))
                    : "—"
                }
              />
              <InfoRow
                k="Sex"
                v={member.staffSex ? (SEX_LABEL[member.staffSex] ?? member.staffSex) : "—"}
              />
              <InfoRow k="Address" v={formatAddress(member) || "—"} />
              <InfoRow
                k="Onboarding"
                v={member.onboardingComplete ? "Complete" : "Not finished"}
              />
              <InfoRow
                k="Government ID"
                v={
                  <span className="flex flex-wrap items-center gap-x-3">
                    {member.governmentIdStatus ?? "Not submitted"}
                    {member.governmentIdStatus === "Pending" && (
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
              <dt className={label}>
                <label htmlFor="approve-designation">Designation</label>
              </dt>
              <dd>
                <select
                  id="approve-designation"
                  value={designation}
                  disabled={busy}
                  onChange={(e) =>
                    setDesignation(e.target.value as AssignableDesignation)
                  }
                  className={selectClass}
                >
                  <option value="" disabled>
                    - Select -
                  </option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </dd>
            </dl>

            {blockers.length > 0 ? (
              <div className="mt-5 rounded-lg bg-gold-lightest px-4 py-3 font-body text-sm text-neutral-charcoal">
                <p className="font-semibold">Can't approve yet</p>
                <p className="mt-1">{blockers.join(" · ")}</p>
              </div>
            ) : (
              <p className="mt-5 font-body text-xs text-neutral-gray">
                Onboarding is done and their ID is verified. Pick a designation
                to approve them — it activates their account at your shelter.
              </p>
            )}
          </div>
        )}
      </SlideOver>

      {member && (
        <ConfirmActionModal
          isOpen={confirmingDecline}
          title="Decline this staff member?"
          confirmLabel="Decline"
          cancelLabel="Cancel"
          isPending={decline.isPending}
          onCancel={() => setConfirmingDecline(false)}
          onConfirm={() => decline.mutate()}
        >
          This declines {member.staffName}'s registration and deactivates their
          account.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default StaffApprovalPanel;
