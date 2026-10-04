// StatsWidget.tsx
// Tile row at the top of the volunteer Overview — same Card + StatTile
// pattern as the other roles' Overviews. Each count is the pagination.total
// of a query in overviewQueries.ts, the same request its widget reads.
// Values fall back to "—" only while loading (via `??`), so a genuine 0
// always shows as 0.
import { useQuery } from "@tanstack/react-query";
import {
  PiClipboardTextBold,
  PiConfettiBold,
  PiStethoscopeBold,
  PiHandHeartBold,
} from "react-icons/pi";
import Card from "../../../../../components/ui/Card";
import StatTile from "../../../../../components/ui/dashboard/StatTile";
import {
  activeTasksQuery,
  eventsServedQuery,
  nextEventsQuery,
  upcomingAppointmentsQuery,
} from "./overviewQueries";

const StatsWidget = () => {
  const { data: tasks } = useQuery(activeTasksQuery);
  const { data: nextEvents } = useQuery(nextEventsQuery);
  const { data: appointments } = useQuery(upcomingAppointmentsQuery);
  const { data: pastEvents } = useQuery(eventsServedQuery);

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile
          icon={<PiClipboardTextBold />}
          value={tasks?.pagination.total ?? "—"}
          label="Active Tasks"
          color="gold"
        />
        <StatTile
          icon={<PiConfettiBold />}
          value={nextEvents?.pagination.total ?? "—"}
          label="Upcoming Events"
          color="teal"
        />
        <StatTile
          icon={<PiStethoscopeBold />}
          value={appointments?.pagination.total ?? "—"}
          label="Upcoming Appointments"
          color="rose"
        />
        <StatTile
          icon={<PiHandHeartBold />}
          value={pastEvents?.pagination.total ?? "—"}
          label="Events Served"
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
