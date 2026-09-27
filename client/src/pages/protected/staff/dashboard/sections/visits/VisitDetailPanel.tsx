// VisitDetailPanel.tsx
// Detail slide-over for one visit, staff/admin side — opened from a Visits
// row's "View Details". Unlike the adopter dashboard's own VisitDetailPanel,
// this doesn't fetch by ID — there's no staff-facing GET /visits/:id (that
// route is adopter-owned only), and the shelter-wide queue row
// (VisitQueueItem) already carries everything the panel needs (adopter,
// pet, remarks, assigned staff), so the already-loaded row is passed down
// directly instead of duplicating the fetch. Confirm/Complete live in the
// footer, one at a time — Confirmed is only valid from an unconfirmed visit,
// Completed only from Confirmed (see visitsApi.ts's updateVisitStatus).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import {
  updateVisitStatus,
  type StaffVisitTransition,
  type VisitQueueItem,
} from "../../../../../../logic/api/visitsApi";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import {
  formatFullDate,
  formatTime,
} from "../../../../../../logic/utils/datetime";

interface VisitDetailPanelProps {
  visit: VisitQueueItem | null;
  onClose: () => void;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Confirmed: "teal",
  Completed: "green",
  Cancelled: "red",
};

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading = "mt-4 font-body text-sm font-semibold text-neutral-dark";
const quoteBlock = "mt-1 font-body text-sm italic text-neutral-charcoal";
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

// The one transition available next, based on the visit's current status —
// never both at once. null (never resolves further from here) once the
// visit is Completed or Cancelled.
const nextTransition = (
  visitStatus: VisitQueueItem["visitStatus"],
): StaffVisitTransition | null => {
  if (visitStatus === null) return "Confirmed";
  if (visitStatus === "Confirmed") return "Completed";
  return null;
};

const VisitDetailPanel = ({ visit, onClose }: VisitDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<StaffVisitTransition | null>(
    null,
  );

  const transition = useMutation({
    mutationFn: (status: StaffVisitTransition) =>
      updateVisitStatus(visit!.visitID, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "visits-queue"] });
      toast.success(status === "Confirmed" ? "Visit confirmed" : "Visit marked completed");
      setPendingAction(null);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const action = visit ? nextTransition(visit.visitStatus) : null;
  const statusLabel = visit?.visitStatus ?? "Unconfirmed";

  return (
    <>
      <SlideOver
        open={visit !== null}
        onClose={onClose}
        title="Visit Details"
        footer={
          action && (
            <ButtonElement
              onClick={() => setPendingAction(action)}
              size="panel"
              className="w-full bg-teal-dark hover:brightness-95"
            >
              {action === "Confirmed" ? "Confirm Visit" : "Mark Completed"}
            </ButtonElement>
          )
        }
      >
        {visit && (
          <div className="p-6">
            {/* Pet / visit summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                <FaPaw className="h-6 w-6 text-rose-md" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {visit.pet ? `Pet Meet - ${visit.pet.petName}` : "Shelter Visit"}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {formatFullDate(new Date(visit.visitTime))} ·{" "}
                  {formatTime(new Date(visit.visitTime))}
                </p>
              </div>
            </div>

            {/* Visitor info */}
            <h3 className={sectionHeading}>Visitor</h3>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Name" v={visit.adopter.adopterName} />
              <InfoRow k="Email" v={visit.adopter.user.userEmail} />
            </dl>

            {/* Visit info */}
            <div className={divider} />
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow
                k="Assigned staff"
                v={visit.staff?.staffName ?? "Not assigned yet"}
              />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[statusLabel] ?? "gold"}>
                  {statusLabel}
                </Badge>
              </dd>
            </dl>

            {/* Remarks */}
            <div className={divider} />
            <h3 className={sectionHeading}>Remarks</h3>
            <p className={quoteBlock}>
              {visit.remarks ? `"${visit.remarks}"` : "No remarks were added."}
            </p>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={pendingAction !== null}
        title={pendingAction === "Confirmed" ? "Confirm this visit?" : "Mark this visit completed?"}
        confirmLabel={pendingAction === "Confirmed" ? "Confirm" : "Mark Completed"}
        isPending={transition.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && transition.mutate(pendingAction)}
      >
        {visit && (
          <p>
            {pendingAction === "Confirmed" ? (
              <>
                This confirms {visit.adopter.adopterName}'s visit
                {visit.pet ? ` to meet ${visit.pet.petName}` : ""} and assigns
                it to you.
              </>
            ) : (
              <>
                This marks {visit.adopter.adopterName}'s visit
                {visit.pet ? ` to meet ${visit.pet.petName}` : ""} as
                completed.
              </>
            )}
          </p>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default VisitDetailPanel;
