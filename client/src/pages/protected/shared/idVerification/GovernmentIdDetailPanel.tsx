// GovernmentIdDetailPanel.tsx
// Detail slide-over for one government ID submission — mirrors
// ApplicationDetailPanel's/AppointmentDetailPanel's own layout (person
// summary banner, InfoRow dl, ConfirmActionModal-driven footer actions).
// Unlike every other place GovernmentID is exposed, this shows the FULL
// idNumber and the actual document image via a signed URL — the dedicated,
// authorized verification workflow those fields exist for. Shared by the
// Staff and Admin dashboards' ID Verification tabs (IdVerificationQueue);
// `scope` namespaces the query keys per dashboard.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import {
  getGovernmentIdDetail,
  updateGovernmentIdStatus,
} from "../../../../logic/api/staffGovernmentIdsApi";
import SlideOver from "../../../../components/ui/SlideOver";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import Avatar from "../../../../components/ui/Avatar";
import { governmentIdTypeBadge } from "../../../../logic/staff/governmentIdUserType";
import { formatVetName } from "../../../../logic/utils/vetName";

interface GovernmentIdDetailPanelProps {
  governmentIDID: number | null;
  onClose: () => void;
  scope: "staff" | "admin";
}

type ReviewAction = "Verified" | "Rejected";

const STATUS_TONE: Record<string, BadgeTone> = {
  Pending: "gold",
  Verified: "green",
  Rejected: "red",
};

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionTitle = "font-display text-lg text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

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

const GovernmentIdDetailPanel = ({
  governmentIDID,
  onClose,
  scope,
}: GovernmentIdDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: [scope, "government-id-review", governmentIDID],
    queryFn: () => getGovernmentIdDetail(governmentIDID!),
    enabled: governmentIDID !== null,
  });

  const review = useMutation({
    mutationFn: (status: ReviewAction) =>
      updateGovernmentIdStatus(governmentIDID!, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({
        queryKey: [scope, "government-ids-queue"],
      });
      queryClient.invalidateQueries({
        queryKey: [scope, "government-id-review", governmentIDID],
      });
      toast.success(
        status === "Verified"
          ? "Government ID verified"
          : "Government ID rejected",
      );
      setPendingAction(null);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const showActions = data?.verificationStatus === "Pending";

  const displayName =
    data?.userType === "Veterinarian"
      ? formatVetName(data.personName)
      : data?.personName;

  return (
    <>
      <SlideOver
        open={governmentIDID !== null}
        onClose={onClose}
        title="Government ID Review"
        footer={
          showActions && (
            <div className="flex gap-3">
              <ButtonElement
                onClick={() => setPendingAction("Rejected")}
                size="panel"
                className="flex-1 bg-red hover:brightness-95"
              >
                Reject
              </ButtonElement>
              <ButtonElement
                onClick={() => setPendingAction("Verified")}
                size="panel"
                className="flex-1 bg-green hover:brightness-95"
              >
                Verify
              </ButtonElement>
            </div>
          )
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading government ID…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this record. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Person summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              <Avatar
                seed={data.personAvatarSeed ?? String(data.userID)}
                size={64}
                className="h-16 w-16 shrink-0 rounded-full ring-2 ring-teal-dark"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {displayName}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.personEmail ?? "No email on file"}
                </p>
              </div>
              <Badge
                tone={governmentIdTypeBadge(data.userType, scope).tone}
                className="shrink-0"
              >
                {governmentIdTypeBadge(data.userType, scope).label}
              </Badge>
            </div>

            {/* ID info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="ID Type" v={data.idType} />
              <InfoRow k="ID Number" v={data.idNumber} />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[data.verificationStatus]}>
                  {data.verificationStatus}
                </Badge>
              </dd>
            </dl>

            {/* Document */}
            <div className={divider} />
            <h2 className={sectionTitle}>Submitted Document</h2>
            {data.documentURL ? (
              <img
                src={data.documentURL}
                alt="Submitted government ID document"
                className="mt-3 w-full rounded-lg border border-neutral-lightgray object-contain"
              />
            ) : (
              <p className="mt-2 font-body text-xs text-neutral-gray">
                No document on file.
              </p>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={pendingAction !== null}
        title={
          pendingAction === "Rejected" ? "Reject this ID?" : "Verify this ID?"
        }
        confirmLabel={pendingAction === "Rejected" ? "Reject" : "Verify"}
        isPending={review.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && review.mutate(pendingAction)}
      >
        {data && (
          <p>
            {pendingAction === "Rejected" ? (
              <>
                This rejects the government ID submitted by{" "}
                <strong>{displayName}</strong>. They'll be able to resubmit a
                new one.
              </>
            ) : (
              <>
                This verifies the government ID submitted by{" "}
                <strong>{displayName}</strong>.
              </>
            )}
          </p>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default GovernmentIdDetailPanel;
