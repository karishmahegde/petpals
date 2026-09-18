// AdminDetailPanel.tsx
// Detail slide-over for one admin account, opened from an Admins row's
// "View". Admin has no editable fields (no designation/shelter, unlike
// Staff) — just identity plus, in the footer, an Activate/Deactivate toggle
// (PATCH /admins/:id/status) gated behind ConfirmActionModal. Pending
// accounts don't get this toggle; they go through AdminApprovalPanel's
// Approve/Decline instead. SlideOver owns the chrome; this owns the fetch
// and the mutation.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Avatar from "../../../../../../components/ui/Avatar";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import {
  getAdminDetail,
  updateAdminStatus,
  type AdminAccountStatus,
} from "../../../../../../logic/api/adminsApi";
import useAuthStore from "../../../../../../logic/store/useAuthStore";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

const SEX_LABELS: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

interface AdminDetailPanelProps {
  userID: number | null;
  onClose: () => void;
}

const infoLabel = "font-body text-sm font-semibold text-teal-dark";
const infoValue = "font-body text-sm text-neutral-charcoal";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={infoLabel}>{k}</dt>
    <dd className={infoValue}>{v}</dd>
  </>
);

const STATUS_TONE: Record<AdminAccountStatus, BadgeTone> = {
  Pending: "gold",
  Active: "green",
  Deactivated: "gray",
};

const AdminDetailPanel = ({ userID, onClose }: AdminDetailPanelProps) => {
  const queryClient = useQueryClient();
  const currentUserID = useAuthStore((state) => state.user?.userID);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "admins", userID],
    queryFn: () => getAdminDetail(userID!),
    enabled: userID !== null,
  });

  const [confirmingStatusChange, setConfirmingStatusChange] = useState(false);

  // Toggles Active <-> Deactivated for an already-approved admin.
  const statusMutation = useMutation({
    mutationFn: () =>
      updateAdminStatus(
        userID!,
        data!.accountStatus === "Active" ? "Deactivated" : "Active",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success(
        data!.accountStatus === "Active"
          ? "Admin deactivated"
          : "Admin activated",
      );
      setConfirmingStatusChange(false);
    },
    onError: () =>
      toast.error(
        `Couldn't ${
          data!.accountStatus === "Active" ? "deactivate" : "activate"
        } this admin. Please try again.`,
      ),
  });

  const isSelf = data?.userID === currentUserID;
  // The backend rejects self-deactivation (there'd be no one left to reverse
  // it), and self-activation is moot — you can't be viewing this panel while
  // Deactivated. Hiding the toggle for your own row avoids a button that
  // would always fail.
  const canToggleStatus =
    !isSelf &&
    (data?.accountStatus === "Active" || data?.accountStatus === "Deactivated");

  return (
    <>
      <SlideOver
        open={userID !== null}
        onClose={onClose}
        title="Admin Details"
        footer={
          data &&
          canToggleStatus && (
            <ButtonElement
              onClick={() => setConfirmingStatusChange(true)}
              size="panel"
              className={`w-full hover:brightness-90 ${
                data.accountStatus === "Active" ? "bg-red" : "bg-green"
              }`}
            >
              {data.accountStatus === "Active"
                ? "Deactivate Admin"
                : "Activate Admin"}
            </ButtonElement>
          )
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading admin…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this admin. Please try again.
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
                  {data.adminName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.user.userEmail}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {data.accountStatus && (
                  <Badge tone={STATUS_TONE[data.accountStatus]}>
                    {data.accountStatus}
                  </Badge>
                )}
                {isSelf && <Badge tone="teal">You</Badge>}
              </div>
            </div>

            {/* Profile info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Email" v={data.user.userEmail} />
              <InfoRow
                k="Phone"
                v={
                  data.adminPhone ? (
                    <PhoneDisplay value={data.adminPhone} />
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                k="Date of birth"
                v={
                  data.adminDOB
                    ? formatFullDate(new Date(`${data.adminDOB.slice(0, 10)}T00:00:00`))
                    : "—"
                }
              />
              <InfoRow k="Sex" v={data.adminSex ? (SEX_LABELS[data.adminSex] ?? data.adminSex) : "—"} />
              <InfoRow k="Address" v={data.adminAddress ?? "—"} />
              <InfoRow k="Joined" v={formatFullDate(new Date(data.createdAt))} />
              <InfoRow
                k="Last login"
                v={
                  data.lastLoginAt
                    ? formatFullDate(new Date(data.lastLoginAt))
                    : "—"
                }
              />
              {data.statusChangedAt && (
                <InfoRow
                  k="Last status change"
                  v={
                    <>
                      {formatFullDate(new Date(data.statusChangedAt))}
                      {data.statusChangedBy && (
                        <> by {data.statusChangedBy.adminName}</>
                      )}
                    </>
                  }
                />
              )}
            </dl>
          </div>
        )}
      </SlideOver>

      {data && (
        <ConfirmActionModal
          isOpen={confirmingStatusChange}
          title={
            data.accountStatus === "Active"
              ? "Deactivate this admin?"
              : "Activate this admin?"
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
              This deactivates {data.adminName}'s account. They won't be able
              to log in until reactivated.
            </>
          ) : (
            <>
              This reactivates {data.adminName}'s account, restoring their
              ability to log in.
            </>
          )}
        </ConfirmActionModal>
      )}
    </>
  );
};

export default AdminDetailPanel;
