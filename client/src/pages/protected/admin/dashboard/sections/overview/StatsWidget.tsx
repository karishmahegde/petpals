// StatsWidget.tsx
// KPI row at the top of the admin Overview page — org-wide counts from
// GET /analytics/overview, rendered via the shared StatTile component.
import { useQuery } from "@tanstack/react-query";
import {
  PiBuildingsBold,
  PiPawPrintBold,
  PiUsersThreeBold,
  PiClipboardTextBold,
  PiChartLineUpBold,
} from "react-icons/pi";
import Card from "../../../../../../components/ui/Card";
import StatTile from "../../../../../../components/ui/dashboard/StatTile";
import { getAnalyticsOverview } from "../../../../../../logic/api/analyticsApi";

const StatsWidget = () => {
  const { data } = useQuery({
    queryKey: ["admin", "analytics-overview"],
    queryFn: getAnalyticsOverview,
  });

  // null covers both "still loading" and "no applications yet" — same
  // placeholder either way, matching the adopter StatsWidget's `?? "—"`.
  const rate = data?.applications.adoptionRate;
  const adoptionRate = rate == null ? "—" : `${Math.round(rate * 100)}%`;

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile
          icon={<PiBuildingsBold />}
          value={data?.shelters.total ?? "—"}
          label="Shelters"
          color="gold"
        />
        <StatTile
          icon={<PiPawPrintBold />}
          value={data?.pets.total ?? "—"}
          label="Pets"
          color="rose"
        />
        <StatTile
          icon={<PiUsersThreeBold />}
          value={data?.adopters.total ?? "—"}
          label="Adopters"
          color="teal"
        />
        <StatTile
          icon={<PiClipboardTextBold />}
          value={data?.applications.total ?? "—"}
          label="Applications"
          color="green"
        />
        <StatTile
          icon={<PiChartLineUpBold />}
          value={adoptionRate}
          label="Adoption Rate"
          color="gold"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
