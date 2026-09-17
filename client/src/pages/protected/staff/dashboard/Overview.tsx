import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";
import StatsWidget from "./sections/overview/StatsWidget";
import ApplicationsWidget from "./sections/overview/ApplicationsWidget";

// Landing section of the staff dashboard. Shows the staff member's own
// shelter name in the greeting subtitle (never a shelter picker — Staff is
// always scoped to one shelter). The rest of the widget row lands in a
// later sprint; see DashboardRoutes.tsx for the other still-scaffolded
// sections.
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

      <div className="mt-6">
        <ApplicationsWidget />
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-neutral-gray/40 bg-white p-10 text-center">
        <DashboardEmptyMessage>
          More Overview widgets are coming in a future sprint — check back
          soon.
        </DashboardEmptyMessage>
      </div>
    </div>
  );
};

export default Overview;
