import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import StatsWidget from "./sections/overview/StatsWidget";
import MonthlyStatsWidget from "./sections/overview/MonthlyStatsWidget";
import SheltersWidget from "./sections/overview/SheltersWidget";
import CapacityAlertsWidget from "./sections/overview/CapacityAlertsWidget";
import StaffApprovalsWidget from "./sections/overview/StaffApprovalsWidget";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";

// Landing / overview section of the admin dashboard.
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji={getGreetingEmoji()}
        message="Organisation-wide operations at a glance"
        showDate
      />

      <StatsWidget />

      <div className="mt-6">
        <MonthlyStatsWidget />
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <SheltersWidget />
        </div>
        <div className="flex-1">
          <CapacityAlertsWidget />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <StaffApprovalsWidget />
        </div>
        <div className="hidden flex-1 lg:block" aria-hidden />
      </div>
    </div>
  );
};

export default Overview;
