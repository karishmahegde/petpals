import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  getMyVisits,
  type VisitListItem,
} from "../../../../logic/api/adoptersApi";
import VisitsList from "./shared/VisitsList";

const isUpcoming = (visit: VisitListItem): boolean =>
  visit.visitStatus !== "Cancelled" &&
  visit.visitStatus !== "Completed" &&
  new Date(visit.visitTime).getTime() > Date.now();

// "Visits" section of the adopter dashboard — upcoming visits first, then
// everything that's been and gone (or was cancelled).
const Visits = () => {
  const { data: visits, isLoading, isError } = useQuery({
    queryKey: ["adopter", "visits", "all"],
    queryFn: () => getMyVisits(),
  });

  const upcoming = (visits ?? []).filter(isUpcoming);
  // Endpoint orders ascending; show the most recent past visit first.
  const past = (visits ?? []).filter((v) => !isUpcoming(v)).reverse();

  return (
    <div>
      <DashboardHeading
        title="Visits"
        emoji="🏠"
        message="Your scheduled shelter visits"
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading your visits…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your visits. Please try again.
        </p>
      )}

      {visits && visits.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            You have no visits scheduled.
          </DashboardEmptyMessage>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Explore Pets
          </ButtonElement>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg text-neutral-dark">
            Upcoming
          </h2>
          <VisitsList visits={upcoming} />
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-neutral-dark">
            Past &amp; cancelled
          </h2>
          <VisitsList visits={past} />
        </section>
      )}
    </div>
  );
};

export default Visits;
