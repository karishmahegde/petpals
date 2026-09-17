// StaffDetailPanel.tsx
// Detail slide-over for one staff member, opened from a Staff row's "View".
// Shows the full profile plus an edit form for staffDesignation and
// shelterID (PATCH /staff/:id), and — below Save, in the footer — an
// Activate/Deactivate toggle (PATCH /staff/:id/status) gated behind
// ConfirmActionModal. Pending accounts don't get this toggle; they go
// through StaffApprovalPanel's Approve/Decline instead. SlideOver owns the
// chrome; this owns the fetch, form state, and both mutations.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import {
  getStaffDetail,
  updateStaff,
  updateStaffStatus,
  type StaffAccountStatus,
  type StaffDesignation,
} from "../../../../../../logic/api/staffApi";
import { getShelterAnalytics } from "../../../../../../logic/api/analyticsApi";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

interface StaffDetailPanelProps {
  userID: number | null;
  onClose: () => void;
}

const labelClass = "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const infoLabel = "font-body text-sm font-semibold text-teal-dark";
const infoValue = "font-body text-sm text-neutral-charcoal";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={infoLabel}>{k}</dt>
    <dd className={infoValue}>{v}</dd>
  </>
);

const DESIGNATION_OPTIONS: StaffDesignation[] = ["Manager", "Senior", "Associate"];
const STATUS_TONE: Record<StaffAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

const StaffDetailPanel = ({ userID, onClose }: StaffDetailPanelProps) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "staff", userID],
    queryFn: () => getStaffDetail(userID!),
    enabled: userID !== null,
  });

  const { data: shelters } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
    enabled: userID !== null,
  });

  const [designation, setDesignation] = useState<StaffDesignation | "">("");
  const [shelterID, setShelterID] = useState<number | "">("");
  const [confirmingStatusChange, setConfirmingStatusChange] = useState(false);

  // Re-seed from the fetched record every time it (re)loads.
  useEffect(() => {
    if (!data) return;
    setDesignation(data.staffDesignation ?? "");
    setShelterID(data.shelterID ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateStaff(userID!, {
        staffDesignation: designation === "" ? undefined : designation,
        shelterID: shelterID === "" ? undefined : shelterID,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "staff-by-shelter"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "shelters-analytics"],
      });
      toast.success("Staff member updated");
    },
    onError: () =>
      toast.error("Couldn't update this staff member. Please try again."),
  });

  // Toggles Active <-> Deactivated for an already-onboarded staff member.
  const statusMutation = useMutation({
    mutationFn: () =>
      updateStaffStatus(
        userID!,
        data!.accountStatus === "Active" ? "Deactivated" : "Active",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      toast.success(
        data!.accountStatus === "Active"
          ? "Staff member deactivated"
          : "Staff member activated",
      );
      setConfirmingStatusChange(false);
    },
    onError: () =>
      toast.error(
        `Couldn't ${
          data!.accountStatus === "Active" ? "deactivate" : "activate"
        } this staff member. Please try again.`,
      ),
  });

  const hasChanges =
    !!data &&
    (designation !== (data.staffDesignation ?? "") ||
      shelterID !== (data.shelterID ?? ""));
  const canSave =
    hasChanges && designation !== "" && shelterID !== "" && !mutation.isPending;

  const canToggleStatus =
    data?.accountStatus === "Active" || data?.accountStatus === "Deactivated";

  return (
    <>
      <SlideOver
        open={userID !== null}
        onClose={onClose}
        title="Staff Details"
        footer={
          data && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={!canSave}
                className="w-full rounded-xl bg-teal-dark px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </button>
              {canToggleStatus && (
                <button
                  type="button"
                  onClick={() => setConfirmingStatusChange(true)}
                  className={`w-full rounded-xl px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 ${
                    data.accountStatus === "Active" ? "bg-red" : "bg-green"
                  }`}
                >
                  {data.accountStatus === "Active"
                    ? "Deactivate Staff"
                    : "Activate Staff"}
                </button>
              )}
            </div>
          )
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading staff member…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this staff member. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Identity summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-teal-dark bg-teal-light p-4">
              <Avatar
                seed={data.avatarSeed}
                size={56}
                className="h-14 w-14 shrink-0 rounded-full ring-2 ring-teal-dark"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {data.staffName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.shelter?.shelterName ?? "No shelter assigned"}
                </p>
              </div>
              {data.accountStatus && (
                <Badge tone={STATUS_TONE[data.accountStatus]}>
                  {data.accountStatus}
                </Badge>
              )}
            </div>

            {/* Profile info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Email" v={data.user.userEmail} />
              <InfoRow
                k="Phone"
                v={
                  data.staffPhone ? (
                    <PhoneDisplay value={data.staffPhone} />
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                k="Date of birth"
                v={data.staffDOB ? formatFullDate(new Date(data.staffDOB)) : "—"}
              />
              <InfoRow k="Sex" v={data.staffSex ?? "—"} />
              <InfoRow
                k="Joined"
                v={data.staffDOJ ? formatFullDate(new Date(data.staffDOJ)) : "—"}
              />
              {data.accountStatus === "Deactivated" && (
                <InfoRow
                  k="Separated"
                  v={
                    data.staffDOS
                      ? formatFullDate(new Date(data.staffDOS))
                      : "—"
                  }
                />
              )}
              {data.managedShelters.length > 0 && (
                <InfoRow
                  k="Manages"
                  v={data.managedShelters.map((s) => s.shelterName).join(", ")}
                />
              )}
            </dl>

            <div className="my-5 border-t border-neutral-lightgray" />

            {/* Edit form — designation + shelter only */}
            <h3 className="mb-3 font-body text-sm font-semibold text-neutral-dark">
              Edit
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass} htmlFor="staff-designation">
                  Designation
                </label>
                <select
                  id="staff-designation"
                  value={designation}
                  onChange={(e) =>
                    setDesignation(e.target.value as StaffDesignation)
                  }
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Select a designation…
                  </option>
                  {DESIGNATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="staff-shelter">
                  Shelter
                </label>
                <select
                  id="staff-shelter"
                  value={shelterID}
                  onChange={(e) =>
                    setShelterID(e.target.value ? Number(e.target.value) : "")
                  }
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Select a shelter…
                  </option>
                  {shelters?.map((shelter) => (
                    <option key={shelter.shelterID} value={shelter.shelterID}>
                      {shelter.shelterName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </SlideOver>

      {data && (
        <ConfirmActionModal
          isOpen={confirmingStatusChange}
          title={
            data.accountStatus === "Active"
              ? "Deactivate this staff member?"
              : "Activate this staff member?"
          }
          confirmLabel={
            data.accountStatus === "Active" ? "Deactivate" : "Activate"
          }
          isPending={statusMutation.isPending}
          onCancel={() => setConfirmingStatusChange(false)}
          onConfirm={() => statusMutation.mutate()}
        >
          {data.accountStatus === "Active" ? (
            <>
              This deactivates {data.staffName}'s account. They won't be able
              to log in until reactivated.
            </>
          ) : (
            <>
              This reactivates {data.staffName}'s account, restoring their
              ability to log in.
            </>
          )}
        </ConfirmActionModal>
      )}
    </>
  );
};

export default StaffDetailPanel;
