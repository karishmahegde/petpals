import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaPlus } from "react-icons/fa";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Card from "../../../../components/ui/Card";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  getMyVisits,
  type VisitListItem,
} from "../../../../logic/api/adoptersApi";
import VisitsList from "./shared/VisitsList";
import VisitDetailPanel from "./visits/VisitDetailPanel";
import ScheduleVisitPanel from "./visits/ScheduleVisitPanel";

const isUpcoming = (visit: VisitListItem): boolean =>
  visit.visitStatus !== "Cancelled" &&
  visit.visitStatus !== "Completed" &&
  new Date(visit.visitTime).getTime() > Date.now();

// "Visits" section of the adopter dashboard — an Upcoming card and a
// Past/Cancelled card, same shape as the Appointments tab.
const Visits = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  // "Schedule a visit" — opened from the header button, or auto-opened
  // pre-filled when arriving via ?petID= from a pet detail page.
  const [searchParams, setSearchParams] = useSearchParams();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePetID, setSchedulePetID] = useState<number | null>(() => {
    const id = Number(searchParams.get("petID"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  useEffect(() => {
    if (schedulePetID !== null) setScheduleOpen(true);
    if (searchParams.has("petID")) {
      searchParams.delete("petID");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        message="Manage shelter visits and meet-and-greets"
        action={{
          label: "Schedule Visit",
          icon: <FaPlus />,
          onClick: () => {
            setSchedulePetID(null);
            setScheduleOpen(true);
          },
        }}
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

      {visits && visits.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Upcoming */}
          <Card className="p-6">
            <DashboardWidgetHeader icon="📝" title="Upcoming Visits" />
            {upcoming.length === 0 ? (
              <DashboardEmptyMessage>
                No upcoming visits.
              </DashboardEmptyMessage>
            ) : (
              <VisitsList visits={upcoming} onViewDetails={setOpenId} />
            )}
          </Card>

          {/* Past / cancelled */}
          <Card className="p-6">
            <DashboardWidgetHeader icon="📁" title="Past/Cancelled Visits" />
            {past.length === 0 ? (
              <DashboardEmptyMessage>
                No past or cancelled visits.
              </DashboardEmptyMessage>
            ) : (
              <VisitsList
                visits={past}
                rowClassName="bg-neutral-lightgray"
                onViewDetails={setOpenId}
              />
            )}
          </Card>
        </div>
      )}

      <VisitDetailPanel visitID={openId} onClose={() => setOpenId(null)} />
      <ScheduleVisitPanel
        open={scheduleOpen}
        initialPetID={schedulePetID}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  );
};

export default Visits;
