// StatsWidget.tsx
// Tile row at the top of the donor Overview — same Card + StatTile pattern
// as the other roles' Overviews, all from GET /donors/me/donations/stats
// (over every donation the donor has made). Values fall back to "—" only
// while loading, so a genuine $0 / 0 always shows.
import { useQuery } from "@tanstack/react-query";
import {
  PiPiggyBankBold,
  PiCalendarStarBold,
  PiHandHeartBold,
  PiHouseLineBold,
} from "react-icons/pi";
import Card from "../../../../../components/ui/Card";
import StatTile from "../../../../../components/ui/dashboard/StatTile";
import { formatUSD } from "../../../../../logic/utils/currency";
import { donationStatsQuery } from "./donorQueries";

const StatsWidget = () => {
  const { data: stats } = useQuery(donationStatsQuery());

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-5">
        <StatTile
          icon={<PiPiggyBankBold />}
          value={stats ? formatUSD(stats.totalAmount) : "—"}
          label="Total Donated"
          color="gold"
        />
        <StatTile
          icon={<PiCalendarStarBold />}
          value={stats ? formatUSD(stats.thisYearAmount) : "—"}
          label="This Year"
          color="green"
        />
        <StatTile
          icon={<PiHandHeartBold />}
          value={stats?.donationCount ?? "—"}
          label="Donations Made"
          color="teal"
        />
        <StatTile
          icon={<PiHouseLineBold />}
          value={stats?.byShelter.length ?? "—"}
          label="Shelters Supported"
          color="rose"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
