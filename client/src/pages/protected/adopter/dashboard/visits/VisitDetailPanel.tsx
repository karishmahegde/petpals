// VisitDetailPanel.tsx
// Detail slide-over for one scheduled visit — opened from a Visits row's
// "View Details". Fetch + render only; the generic SlideOver owns the chrome.
// Footer "Cancel Visit" runs the same confirm-then-mutate flow as the row
// action, invalidating the same query key.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import { getVisitById, cancelVisit } from "../../../../../logic/api/visitsApi";
import SlideOver from "../../../../../components/ui/SlideOver";
import Badge, { type BadgeTone } from "../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../components/ui/ConfirmActionModal";
import {
  formatFullDate,
  formatTime,
} from "../../../../../logic/utils/datetime";

interface VisitDetailPanelProps {
  visitID: number | null;
  onClose: () => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionHeading = "mt-4 font-body text-sm font-semibold text-neutral-dark";
const quoteBlock = "mt-1 font-body text-sm italic text-neutral-charcoal";
const divider = "my-5 border-t border-neutral-lightgray";

const STATUS_TONE: Record<string, BadgeTone> = {
  Confirmed: "teal",
  Cancelled: "neutral",
  Completed: "neutral",
};

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const VisitDetailPanel = ({ visitID, onClose }: VisitDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "visit", visitID],
    queryFn: () => getVisitById(visitID!),
    enabled: visitID !== null,
  });

  const cancel = useMutation({
    mutationFn: () => cancelVisit(visitID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adopter", "visits"] });
      queryClient.invalidateQueries({
        queryKey: ["adopter", "visit", visitID],
      });
      toast.success("Visit cancelled");
      setConfirmOpen(false);
      onClose();
    },
    onError: () => toast.error("Couldn't cancel the visit. Please try again."),
  });

  const statusLabel = data ? (data.visitStatus ?? "Pending confirmation") : "";
  const petName = data?.pet?.petName;

  return (
    <>
      <SlideOver
        open={visitID !== null}
        onClose={onClose}
        title="Visit Details"
        footer={
          data?.canCancel && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-xl bg-red px-4 py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-95"
            >
              Cancel Visit
            </button>
          )
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading visit…
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this visit. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            {/* Pet / visit summary */}
            <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
              {data.pet?.petPhoto ? (
                <img
                  src={data.pet.petPhoto}
                  alt={`${data.pet.petName} photo`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                  <FaPaw className="h-6 w-6 text-rose-md" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body font-bold text-neutral-charcoal">
                  {petName ? `Pet Meet — ${petName}` : "Shelter Visit"}
                </p>
                <p className="truncate text-xs text-neutral-gray">
                  {data.pet
                    ? `${data.pet.breedName} · ${data.shelterName}`
                    : data.shelterName}
                </p>
              </div>
            </div>

            {/* Visit info */}
            <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Date" v={formatFullDate(new Date(data.visitTime))} />
              <InfoRow k="Time" v={formatTime(new Date(data.visitTime))} />
              <InfoRow k="Shelter" v={data.shelterName} />
              <InfoRow k="Location" v={data.shelterAddress} />
              <InfoRow
                k="Assigned staff"
                v={data.assignedStaffName ?? "Not assigned yet"}
              />
              <dt className={label}>Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[statusLabel] ?? "gold"}>
                  {statusLabel}
                </Badge>
              </dd>
            </dl>

            {/* Purpose */}
            <div className={divider} />
            <h3 className={sectionHeading}>Purpose</h3>
            <p className={quoteBlock}>
              {data.remarks
                ? `"${data.remarks}"`
                : "No note was added for this visit."}
            </p>
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={confirmOpen}
        title="Cancel this visit?"
        confirmLabel="Cancel visit"
        isPending={cancel.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => cancel.mutate()}
      >
        {data && (
          <>
            This cancels your visit
            {petName ? ` to meet ${petName}` : ""} at {data.shelterName}. You
            can always schedule a new one.
          </>
        )}
      </ConfirmActionModal>
    </>
  );
};

export default VisitDetailPanel;
