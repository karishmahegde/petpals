// NextEventsWidget.tsx
// "My Next Events" on the volunteer Overview — upcoming events at their
// shelter that staff have assigned them to (GET
// /volunteers/me/events?assigned=true&upcoming=true), soonest first.
// Read-only: volunteers don't sign themselves up. "View All" and each row's
// "View Details" go to the Events tab.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../components/ui/Badge";
import { formatTime, relativeDateBadge } from "../../../../../logic/utils/datetime";
import { nextEventsQuery } from "./overviewQueries";
import DateBlock from "../shared/DateBlock";

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
};

const NextEventsWidget = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(nextEventsQuery);
  const events = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="🎉"
      title="My Next Events"
      action={{ label: "View All", to: "/volunteer/events" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={events.length === 0}
      emptyMessage="You're not assigned to any upcoming events"
    >
      <ul className="flex flex-col gap-4">
        {events.map((event) => {
          const when = new Date(event.eventDate);
          const badgeLabel = relativeDateBadge(when);

          return (
            <li key={event.eventID}>
              <DashboardListRow
                leading={<DateBlock iso={event.eventDate} />}
                title={event.eventName}
                lines={[{ text: `${formatTime(when)} | ${event.shelter.shelterName}` }]}
                badge={{ label: badgeLabel, tone: BADGE_TONE[badgeLabel] ?? "teal" }}
                actions={
                  <RowActionButton onClick={() => navigate("/volunteer/events")}>
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

export default NextEventsWidget;
