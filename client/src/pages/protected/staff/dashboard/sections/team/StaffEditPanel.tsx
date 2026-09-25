// StaffEditPanel.tsx
// "Edit Staff" slide-over for the shelter manager — opened from an All Staff
// row's "Edit" (only on other Active staff). The row already carries every
// field, so there's no refetch; the caller remounts this per member via
// `key` to seed the designation. Name/email/phone/joining date are
// read-only (each person edits their own on Profile); designation
// (Senior/Associate) is the only editable field. Footer: Save, and
// Deactivate Staff behind a ConfirmActionModal.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { formatPhoneDisplay } from "../../../../../../logic/utils/phone";
import { formatFullDate } from "../../../../../../logic/utils/datetime";
import {
  updateTeamDesignation,
  updateTeamStatus,
  type AssignableDesignation,
  type TeamMember,
} from "../../../../../../logic/api/teamApi";

interface StaffEditPanelProps {
  member: TeamMember | null;
  onClose: () => void;
}

const DESIGNATIONS: AssignableDesignation[] = ["Senior", "Associate"];

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const readOnlyFieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-neutral-offwhite px-3 py-2.5 font-body text-sm text-neutral-gray focus:outline-none";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const ReadOnlyField = ({ id, label, value }: { id: string; label: string; value: string }) => (
  <div>
    <label className={labelClass} htmlFor={id}>
      {label}
    </label>
    <input id={id} readOnly value={value} className={readOnlyFieldClass} />
  </div>
);

const StaffEditPanel = ({ member, onClose }: StaffEditPanelProps) => {
  const queryClient = useQueryClient();
  const initialDesignation = (member?.staffDesignation ?? "") as AssignableDesignation | "";
  const [designation, setDesignation] = useState(initialDesignation);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const refreshTeam = () =>
    queryClient.invalidateQueries({ queryKey: ["staff", "team"] });

  const save = useMutation({
    mutationFn: () =>
      updateTeamDesignation(member!.userID, designation as AssignableDesignation),
    onSuccess: () => {
      refreshTeam();
      toast.success("Staff member updated");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const deactivate = useMutation({
    mutationFn: () => updateTeamStatus(member!.userID, "Deactivated"),
    onSuccess: () => {
      refreshTeam();
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
        title="Edit Staff"
        footer={
          member && (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => save.mutate()}
                disabled={!canSave}
                size="panel"
                className="w-full bg-green hover:brightness-95 disabled:cursor-not-allowed"
              >
                {save.isPending ? "Saving…" : "Save"}
              </ButtonElement>
              <ButtonElement
                onClick={() => setConfirmingDeactivate(true)}
                size="panel"
                className="w-full bg-red hover:brightness-90"
              >
                Deactivate Staff
              </ButtonElement>
            </div>
          )
        }
      >
        {member && (
          <div className="flex flex-col gap-4 p-6">
            <ReadOnlyField id="staff-name" label="Staff Name" value={member.staffName} />
            <ReadOnlyField id="staff-email" label="Email" value={member.staffEmail} />
            <ReadOnlyField
              id="staff-phone"
              label="Phone"
              value={member.staffPhone ? formatPhoneDisplay(member.staffPhone) : "—"}
            />
            <div>
              <label className={labelClass} htmlFor="staff-designation">
                Designation
              </label>
              <select
                id="staff-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value as AssignableDesignation)}
                className={fieldClass}
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
            </div>
            <ReadOnlyField
              id="staff-doj"
              label="Date of Joining"
              value={member.staffDOJ ? formatFullDate(new Date(member.staffDOJ)) : "—"}
            />
          </div>
        )}
      </SlideOver>

      {member && (
        <ConfirmActionModal
          isOpen={confirmingDeactivate}
          title="Deactivate this staff member?"
          confirmLabel="Deactivate"
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

export default StaffEditPanel;
