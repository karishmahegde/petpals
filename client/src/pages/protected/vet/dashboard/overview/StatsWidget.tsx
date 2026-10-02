// StatsWidget.tsx
// Tile row at the top of the vet Overview — same Card + StatTile pattern as
// the Staff and Admin Overviews. Values fall back to "—" only while loading
// (via `??`), so a genuine 0 always shows as 0.
//   - Today's Appointments: useTodaysAppointments (same data as the widget).
//   - Overdue Vaccinations: GET /vets/me/vaccinations/overdue (same request
//     as the widget).
//   - Pets Treated: GET /vets/me/stats.
//   - The vet's shelter, by name (label-only tile).
import { useQuery } from "@tanstack/react-query";
import {
  PiStethoscopeBold,
  PiSyringeBold,
  PiDogBold,
  PiHouseLineBold,
} from "react-icons/pi";
import Card from "../../../../../components/ui/Card";
import StatTile from "../../../../../components/ui/dashboard/StatTile";
import { getMyVetStats } from "../../../../../logic/api/vetsApi";
import useTodaysAppointments from "./useTodaysAppointments";
import { overdueVaccinationsQuery } from "./overdueVaccinationsQuery";

interface StatsWidgetProps {
  shelterName: string | undefined;
}

const StatsWidget = ({ shelterName }: StatsWidgetProps) => {
  const today = useTodaysAppointments();
  const { data: overdue } = useQuery(overdueVaccinationsQuery);
  const { data: stats } = useQuery({
    queryKey: ["vet", "stats"],
    queryFn: getMyVetStats,
  });

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile
          icon={<PiStethoscopeBold />}
          value={today.isReady ? today.appointments.length : "—"}
          label="Today's Appointments"
          color="gold"
        />
        <StatTile
          icon={<PiSyringeBold />}
          value={overdue?.length ?? "—"}
          label="Overdue Vaccinations"
          color="rose"
        />
        <StatTile
          icon={<PiDogBold />}
          value={stats?.petsTreated ?? "—"}
          label="Pets Treated"
          color="teal"
        />
        <StatTile
          icon={<PiHouseLineBold />}
          label={shelterName ?? "—"}
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
