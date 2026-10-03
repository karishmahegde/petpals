import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import { getMyVolunteerProfile } from "../../../../logic/api/volunteersApi";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";
import StatsWidget from "./overview/StatsWidget";
import MyTasksWidget from "./overview/MyTasksWidget";
import NextEventsWidget from "./overview/NextEventsWidget";
import AppointmentsWidget from "./overview/AppointmentsWidget";
import ShelterDetailsWidget from "../../shared/ShelterDetailsWidget";

// Landing section of the volunteer dashboard (/volunteer): greeting, a stats
// row, then My Tasks, My Next Events, Assisting Appointments and Shelter
// Details. Each widget owns its own query and loading/empty state; tiles
// and widgets share each query (overview/overviewQueries.ts).
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const profileQuery = useQuery({
    queryKey: ["volunteer", "me"],
    queryFn: getMyVolunteerProfile,
  });

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji={getGreetingEmoji()}
        message="Your tasks and schedule at a glance"
        showDate
      />

      <StatsWidget />

      {/* Same fixed min-height per widget as the Staff and vet Overviews,
          so an empty card doesn't look squashed next to a full one. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MyTasksWidget />
        <NextEventsWidget />
        <AppointmentsWidget />
        <ShelterDetailsWidget
          shelter={profileQuery.data?.shelter}
          isLoading={profileQuery.isLoading}
        />
      </div>
    </div>
  );
};

export default Overview;
