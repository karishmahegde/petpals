// VisitsList.tsx
// The adopter's visit rows — used by both the Overview preview widget and the
// full Visits section. The Visits-specific config for the generic
// DashboardActionList: the row markup + the cancel action.
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { RowLine } from "../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../components/ui/Badge";
import type { VisitListItem } from "../../../../../logic/api/adoptersApi";
import { cancelVisit } from "../../../../../logic/api/visitsApi";
import { formatTime, relativeDateBadge } from "../../../../../logic/utils/datetime";

interface VisitsListProps {
  visits: VisitListItem[];
  /** Row background — defaults to the DashboardListRow gold tint. */
  rowClassName?: string;
  /**
   * "View Details" handler. When given (the full section), each row gets a
   * View Details button that opens the detail slide-over; omitted on the
   * Overview widget, which stays action-light.
   */
  onViewDetails?: (visitID: number) => void;
}

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
  Past: "neutral",
  Cancelled: "neutral",
  Completed: "neutral",
};

const VisitsList = ({
  visits,
  rowClassName,
  onViewDetails,
}: VisitsListProps) => (
  <DashboardActionList
    items={visits}
    getKey={(visit) => visit.visitID}
    renderRow={(visit, confirmCancel) => {
      const when = new Date(visit.visitTime);
      const isClosed =
        visit.visitStatus === "Cancelled" || visit.visitStatus === "Completed";
      const badgeLabel = isClosed
        ? visit.visitStatus!
        : relativeDateBadge(when);
      const canCancel = !isClosed && when.getTime() > Date.now();

      const lines: RowLine[] = [
        { text: `${formatTime(when)} | ${visit.shelter.shelterName}` },
      ];
      if (visit.remarks) lines.push({ text: visit.remarks });

      return (
        <DashboardListRow
          className={rowClassName}
          leading={
            <div className="w-12 shrink-0 text-center">
              <p className="font-body text-sm font-bold text-neutral-charcoal">
                {when.toLocaleDateString("en-US", { month: "short" })}
              </p>
              <p className="font-display text-3xl font-light text-neutral-charcoal">
                {when.getDate()}
              </p>
            </div>
          }
          title={
            visit.pet ? `Pet Meet - ${visit.pet.petName}` : "Shelter Visit"
          }
          lines={lines}
          badge={{
            label: badgeLabel,
            tone: BADGE_TONE[badgeLabel] ?? "teal",
          }}
          actions={
            (onViewDetails || canCancel) && (
              <>
                {onViewDetails && (
                  <RowActionButton
                    onClick={() => onViewDetails(visit.visitID)}
                  >
                    View Details
                  </RowActionButton>
                )}
                {canCancel && (
                  <RowActionButton
                    variant="danger"
                    onClick={() => confirmCancel(visit)}
                  >
                    Cancel
                  </RowActionButton>
                )}
              </>
            )
          }
        />
      );
    }}
    confirmAction={{
      mutationFn: (visit) => cancelVisit(visit.visitID),
      invalidateKeys: [["adopter", "visits"]],
      successToast: "Visit cancelled",
      errorToast: "Couldn't cancel the visit. Please try again.",
      modalTitle: "Cancel this visit?",
      confirmLabel: "Cancel visit",
      renderBody: (visit) => (
        <>
          This cancels your visit
          {visit.pet ? ` to meet ${visit.pet.petName}` : ""} at{" "}
          {visit.shelter.shelterName}. You can always schedule a new one.
        </>
      ),
    }}
  />
);

export default VisitsList;
