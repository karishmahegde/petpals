import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";
import StatsWidget from "./sections/overview/StatsWidget";
import ApplicationsWidget from "./sections/overview/ApplicationsWidget";
import TodaysVisitsWidget from "./sections/overview/TodaysVisitsWidget";
import NewArriversWidget from "./sections/overview/NewArriversWidget";
import UpcomingEventsWidget from "./sections/overview/UpcomingEventsWidget";

// Landing section of the staff dashboard. Shows the staff member's own
// shelter name in the greeting subtitle (never a shelter picker — Staff is
// always scoped to one shelter). See DashboardRoutes.tsx for the still-
// scaffolded tab sections these widgets' "View All" links point to.
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });

  const shelterName = profile?.shelter?.shelterName;

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji={getGreetingEmoji()}
        message={
          shelterName
            ? `Here's what's happening at ${shelterName} today`
            : "Here's what's happening at your shelter today"
        }
        showDate
      />

      <StatsWidget />

      {/* Each widget sets its own min-h-[420px] so all four stay the same
          size regardless of how much (or little) each has to show — an
          empty "No visits scheduled for today" card shouldn't look
          squashed next to a full one. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ApplicationsWidget />
        <TodaysVisitsWidget />
        <NewArriversWidget />
        <UpcomingEventsWidget />
      </div>
    </div>
  );
};

export default Overview;
