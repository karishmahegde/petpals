// UpcomingEventsWidget.tsx
// "Upcoming Events" preview widget on the Staff Overview page — the
// nearest upcoming event(s) at the staff member's shelter (GET /events with
// upcoming=true, soonest first). "View All" leads
// to /staff/events (still a placeholder tab — a later sprint card builds it
// out).
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../../components/ui/Badge";
import { getMyStaffProfile } from "../../../../../../logic/api/staffApi";
import { getEvents } from "../../../../../../logic/api/eventsApi";
import { formatTime, relativeDateBadge } from "../../../../../../logic/utils/datetime";

const PREVIEW_LIMIT = 3;

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
};

const UpcomingEventsWidget = () => {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const shelterID = profile?.shelterID;

  const { data, isLoading } = useQuery({
    queryKey: ["staff", "upcoming-events", { shelterID, limit: PREVIEW_LIMIT }],
    queryFn: () =>
      getEvents({ shelterID: shelterID as number, upcoming: true, limit: PREVIEW_LIMIT }),
    enabled: shelterID != null,
  });

  const loading = isLoading || shelterID == null;
  const events = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="🎉"
      title="Upcoming Events"
      action={{ label: "View All", to: "/staff/events" }}
      className="min-h-[420px]"
      isLoading={loading}
      isEmpty={events.length === 0}
      emptyMessage="No upcoming events"
    >
      <ul className="flex flex-col gap-4">
        {events.map((event) => {
          const when = new Date(event.eventDate);
          const badgeLabel = relativeDateBadge(when);

          return (
            <li key={event.eventID}>
              <DashboardListRow
                leading={
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-body text-sm font-bold text-neutral-charcoal">
                      {when.toLocaleDateString("en-US", { month: "short" })}
                    </p>
                    <p className="font-display text-3xl font-light text-neutral-charcoal">
                      {when.getDate()}
                    </p>
                  </div>
                }
                title={event.eventName}
                lines={[{ text: `${formatTime(when)} | ${event.shelter.shelterName}` }]}
                badge={{
                  label: badgeLabel,
                  tone: BADGE_TONE[badgeLabel] ?? "teal",
                }}
                actions={
                  <RowActionButton onClick={() => navigate("/staff/events")}>
                    View Details
                  </RowActionButton>
                }
              />
            </li>
          );
        })}
      </ul>
    </OverviewWidgetCard>
  );
};

export default UpcomingEventsWidget;
