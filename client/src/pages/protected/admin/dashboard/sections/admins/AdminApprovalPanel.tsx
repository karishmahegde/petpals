// AdminApprovalPanel.tsx
// Detail slide-over for one Pending (self-registered, awaiting approval)
// admin account — opened from the Admin Approvals section's "View Details".
// Read-only profile plus Approve/Decline in the footer, both going through
// the existing PATCH /admins/:id/status endpoint (Active = approve,
// Deactivated = decline — there's no dedicated approve/decline endpoint).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import Avatar from "../../../../../../components/ui/Avatar";
import PhoneDisplay from "../../../../../../components/ui/PhoneDisplay";
import {
  getAdminDetail,
  updateAdminStatus,
  type AdminAccountStatusTarget,
} from "../../../../../../logic/api/adminsApi";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

interface AdminApprovalPanelProps {
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

const AdminApprovalPanel = ({ userID, onClose }: AdminApprovalPanelProps) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "admins", userID],
    queryFn: () => getAdminDetail(userID!),
    enabled: userID !== null,
  });

  const mutation = useMutation({
    mutationFn: (accountStatus: AdminAccountStatusTarget) =>
      updateAdminStatus(userID!, accountStatus),
    onSuccess: (_, accountStatus) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success(
        accountStatus === "Active" ? "Admin approved" : "Admin declined",
      );
      onClose();
    },
    onError: (_, accountStatus) =>
      toast.error(
        `Couldn't ${accountStatus === "Active" ? "approve" : "decline"} this admin. Please try again.`,
      ),
  });

  return (
    <SlideOver
      open={userID !== null}
      onClose={onClose}
      title="Admin Approval"
      footer={
        data && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => mutation.mutate("Active")}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-green px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? "Working…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate("Deactivated")}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-red px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? "Working…" : "Decline"}
            </button>
          </div>
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
          <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
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
                Awaiting approval
              </p>
            </div>
          </div>

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
              k="Applied on"
              v={formatFullDate(new Date(data.createdAt))}
            />
          </dl>

          <p className="mt-5 font-body text-xs text-neutral-gray">
            Approving activates this account and lets them log in. Declining
            deactivates the account the same way a manual deactivation would.
          </p>
        </div>
      )}
    </SlideOver>
  );
};

export default AdminApprovalPanel;
