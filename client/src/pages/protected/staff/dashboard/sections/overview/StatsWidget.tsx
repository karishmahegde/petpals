// StatsWidget.tsx
// KPI row at the top of the staff Overview page — mirrors Admin's
// StatsWidget (same Card + StatTile pattern). Only "Applications" is wired
// to real data right now: it's the only one of the four with a Staff-facing
// endpoint that exists yet.
//   - Pets: would need the shelter's capacity (shelterSize) to show as
//     current/capacity like the design calls for, but GET /staff/me only
//     returns the shelter's name, not its size, and the endpoint that does
//     (GET /analytics/shelters) is Admin-only. Placeholder until a
//     Staff-facing shelter-capacity endpoint exists.
//   - Visits Today: needs GET /visits (Sprint 5.2, not built yet).
//   - Pending Transfers: the Transfers domain has no backend at all yet.
import { useQuery } from "@tanstack/react-query";
import {
  PiPawPrintBold,
  PiCalendarCheckBold,
  PiClipboardTextBold,
  PiArrowsClockwiseBold,
} from "react-icons/pi";
import Card from "../../../../../../components/ui/Card";
import StatTile from "../../../../../../components/ui/dashboard/StatTile";
import { getApplicationsQueue } from "../../../../../../logic/api/adoptionApplicationsApi";

const StatsWidget = () => {
  const { data } = useQuery({
    queryKey: ["staff", "applications-queue", { status: "Pending", limit: 1 }],
    // limit: 1 — this tile only needs pagination.total, not the rows.
    queryFn: () => getApplicationsQueue({ status: "Pending", limit: 1 }),
  });

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile icon={<PiPawPrintBold />} value="—" label="Pets" color="gold" />
        <StatTile
          icon={<PiCalendarCheckBold />}
          value="—"
          label="Visits Today"
          color="teal"
        />
        <StatTile
          icon={<PiClipboardTextBold />}
          value={data?.pagination.total ?? "—"}
          label="Applications"
          color="rose"
        />
        <StatTile
          icon={<PiArrowsClockwiseBold />}
          value="—"
          label="Pending Transfers"
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
