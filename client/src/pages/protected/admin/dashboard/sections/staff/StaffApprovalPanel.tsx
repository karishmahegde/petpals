// StaffApprovalPanel.tsx
// Detail slide-over for one Pending Manager sign-up (the first staff
// sign-up at a shelter without a manager) — opened from the Manager
// Approvals section's "View Details". Approving also makes them that
// shelter's manager, server-side.
// Read-only profile plus Approve/Decline in the footer, both going through
// the existing PATCH /staff/:id/status endpoint (Active = approve,
// Deactivated = decline — there's no dedicated approve/decline endpoint).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Avatar from "../../../../../../components/ui/Avatar";
import {
  getStaffDetail,
  updateStaffStatus,
  type StaffAccountStatusTarget,
} from "../../../../../../logic/api/staffApi";
import { formatFullDate } from "../../../../../../logic/utils/datetime";

interface StaffApprovalPanelProps {
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

const StaffApprovalPanel = ({ userID, onClose }: StaffApprovalPanelProps) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "staff", userID],
    queryFn: () => getStaffDetail(userID!),
    enabled: userID !== null,
  });

  const mutation = useMutation({
    mutationFn: (accountStatus: StaffAccountStatusTarget) =>
      updateStaffStatus(userID!, accountStatus),
    onSuccess: (_, accountStatus) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
      // Approving sets the shelter's manager — refresh the shelter views too.
      queryClient.invalidateQueries({ queryKey: ["admin", "shelters-analytics"] });
      toast.success(
        accountStatus === "Active" ? "Manager approved" : "Manager declined",
      );
      onClose();
    },
    onError: (_, accountStatus) =>
      toast.error(
        `Couldn't ${accountStatus === "Active" ? "approve" : "decline"} this staff member. Please try again.`,
      ),
  });

  return (
    <SlideOver
      open={userID !== null}
      onClose={onClose}
      title="Staff Approval"
      footer={
        data && (
          <div className="flex gap-3">
            <ButtonElement
              onClick={() => mutation.mutate("Active")}
              disabled={mutation.isPending}
              size="panel"
              className="flex-1 bg-green hover:brightness-95 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Working…" : "Approve"}
            </ButtonElement>
            <ButtonElement
              onClick={() => mutation.mutate("Deactivated")}
              disabled={mutation.isPending}
              size="panel"
              className="flex-1 bg-red hover:brightness-95 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Working…" : "Decline"}
            </ButtonElement>
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
          <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
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
                Awaiting approval
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Email" v={data.user.userEmail} />
            <InfoRow k="Phone" v={data.staffPhone ?? "—"} />
            <InfoRow
              k="Requested shelter"
              v={data.shelter?.shelterName ?? "Not specified"}
            />
            <InfoRow
              k="Applied on"
              v={data.staffDOJ ? formatFullDate(new Date(data.staffDOJ)) : "—"}
            />
          </dl>

          <p className="mt-5 font-body text-xs text-neutral-gray">
            Approving activates this account and lets them log in. Shelter and
            designation can be assigned afterward from the staff list.
            Declining deactivates the account the same way a manual
            deactivation would.
          </p>
        </div>
      )}
    </SlideOver>
  );
};

export default StaffApprovalPanel;
