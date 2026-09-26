// StaffDetailPanel.tsx
// "Staff Details" slide-over for the shelter manager — opened from an All
// Staff row's "View Details". The row already carries every field, so
// there's no refetch; the caller remounts this per member via `key` to seed
// the designation. Same identity banner + InfoRow layout as
// VolunteerDetailPanel. Everything is read-only (each person edits their
// own details on Profile) except, when `canManage` (another Active staff
// member, not the manager themselves), the designation (Senior/Associate)
// — with Save and Deactivate Staff (behind a ConfirmActionModal) in the
// footer.
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
import type { StaffAccountStatus } from "../../../../../../logic/api/staffApi";
import {
  updateShelterStaffDesignation,
  updateShelterStaffStatus,
  type AssignableDesignation,
  type ShelterStaffMember,
} from "../../../../../../logic/api/shelterStaffApi";

interface StaffDetailPanelProps {
  member: ShelterStaffMember | null;
  /** Designation change + deactivate — another Active staff member only. */
  canManage: boolean;
  onClose: () => void;
}

const DESIGNATIONS: AssignableDesignation[] = ["Senior", "Associate"];

const STATUS_TONE: Record<StaffAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

const SEX_LABEL: Record<"M" | "F", string> = { M: "Male", F: "Female" };

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

const formatDate = (date: string | null) =>
  date ? formatFullDate(new Date(date)) : "—";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const StaffDetailPanel = ({
  member,
  canManage,
  onClose,
}: StaffDetailPanelProps) => {
  const queryClient = useQueryClient();
  const initialDesignation = (member?.staffDesignation ?? "") as
    AssignableDesignation | "";
  const [designation, setDesignation] = useState(initialDesignation);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const refreshStaff = () =>
    queryClient.invalidateQueries({ queryKey: ["staff", "staff-members"] });

  const save = useMutation({
    mutationFn: () =>
      updateShelterStaffDesignation(
        member!.userID,
        designation as AssignableDesignation,
      ),
    onSuccess: () => {
      refreshStaff();
      toast.success("Staff member updated");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deactivate = useMutation({
    mutationFn: () => updateShelterStaffStatus(member!.userID, "Deactivated"),
    onSuccess: () => {
      refreshStaff();
      toast.success("Staff member deactivated");
      setConfirmingDeactivate(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const canSave =
    designation !== "" && designation !== initialDesignation && !save.isPending;

  return (
    <>
      <SlideOver
        open={member !== null}
        onClose={onClose}
        title="Staff Details"
        footer={
          member && canManage ? (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => save.mutate()}
                disabled={!canSave}
                size="panel"
                className="w-full bg-green hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </ButtonElement>
              <ButtonElement
                onClick={() => setConfirmingDeactivate(true)}
                size="panel"
                className="w-full bg-red hover:brightness-95"
              >
                Deactivate Staff
              </ButtonElement>
            </div>
          ) : undefined
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
                  {member.staffDesignation ?? "No designation"}
                </p>
              </div>
              <Badge tone={STATUS_TONE[member.accountStatus]}>
                {member.accountStatus}
              </Badge>
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
              {canManage ? (
                <>
                  <dt className={label}>
                    <label htmlFor="staff-designation">Designation</label>
                  </dt>
                  <dd>
                    <select
                      id="staff-designation"
                      value={designation}
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
                </>
              ) : (
                <InfoRow k="Designation" v={member.staffDesignation ?? "—"} />
              )}
              <InfoRow k="Date of Birth" v={formatDate(member.staffDOB)} />
              <InfoRow
                k="Sex"
                v={member.staffSex ? SEX_LABEL[member.staffSex] : "—"}
              />
              <InfoRow k="Date of Joining" v={formatDate(member.staffDOJ)} />
              {member.accountStatus === "Deactivated" && (
                <InfoRow
                  k="Date of Separation"
                  v={formatDate(member.staffDOS)}
                />
              )}
            </dl>
          </div>
        )}
      </SlideOver>

      {member && (
        <ConfirmActionModal
          isOpen={confirmingDeactivate}
          title="Deactivate this staff member?"
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          isPending={deactivate.isPending}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => deactivate.mutate()}
        >
          This deactivates {member.staffName}'s account. They won't be able to
          log in.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default StaffDetailPanel;
