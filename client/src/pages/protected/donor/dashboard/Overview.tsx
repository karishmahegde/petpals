import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import Card from "../../../../components/ui/Card";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";
import StatsWidget from "./overview/StatsWidget";
import RecentDonationsWidget from "./overview/RecentDonationsWidget";
import DonateForm from "./shared/DonateForm";

// Landing section of the donor dashboard (/donor): greeting, giving totals,
// the donate form (same as the Donate tab) and Recent Donations. Each widget
// owns its own query and loading/empty state (overview/donorQueries.ts).
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji={getGreetingEmoji()}
        message="Thank you for supporting animal welfare"
        showDate
      />

      <StatsWidget />

      <div className="mt-6 flex flex-col gap-6">
        <Card className="p-5">
          <DashboardWidgetHeader icon="💰" title="Let's Make a Donation" className="mb-4" />
          <DonateForm idPrefix="overview-donate" />
        </Card>
        <RecentDonationsWidget />
      </div>
    </div>
  );
};

export default Overview;
