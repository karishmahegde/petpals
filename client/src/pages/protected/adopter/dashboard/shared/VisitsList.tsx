// VisitsList.tsx
// The adopter's visit rows — used by both the Overview preview widget and the
// full Visits section. The Visits-specific config for the generic
// DashboardActionList: the row markup + the cancel action.
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { VisitListItem } from "../../../../../logic/api/adoptersApi";
import { cancelVisit } from "../../../../../logic/api/visitsApi";
import { relativeDateBadge } from "../../../../../logic/utils/datetime";

interface VisitsListProps {
  visits: VisitListItem[];
  /** Row background — defaults to the DashboardListRow gold tint. */
  rowClassName?: string;
}

const BADGE_CLASS: Record<string, string> = {
  Soon: "bg-gold-md text-neutral-dark",
  Upcoming: "bg-teal-light text-teal-dark",
  Past: "bg-neutral-lightgray text-neutral-charcoal",
  Cancelled: "bg-neutral-lightgray text-neutral-charcoal",
  Completed: "bg-neutral-lightgray text-neutral-charcoal",
};

const VisitsList = ({ visits, rowClassName }: VisitsListProps) => (
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
          lines={[{ text: visit.shelter.shelterName }]}
          badge={{
            label: badgeLabel,
            className: BADGE_CLASS[badgeLabel] ?? BADGE_CLASS.Upcoming,
          }}
          actions={
            canCancel && (
              <RowActionButton
                variant="danger"
                onClick={() => confirmCancel(visit)}
              >
                Cancel
              </RowActionButton>
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
