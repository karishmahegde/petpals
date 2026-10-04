import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import { getMyVetProfile } from "../../../../logic/api/vetsApi";
import { formatVetName } from "../../../../logic/utils/vetName";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";
import StatsWidget from "./overview/StatsWidget";
import TodaysAppointmentsWidget from "./overview/TodaysAppointmentsWidget";
import OverdueVaccinationsWidget from "./overview/OverdueVaccinationsWidget";
import ShelterDetailsWidget from "../../shared/ShelterDetailsWidget";
import AppointmentDetailPanel from "./sections/appointments/AppointmentDetailPanel";

// Landing section of the vet dashboard (/vet): greeting ("Good afternoon,
// Dr. <surname>"), a stats row, then Today's Appointments, Overdue
// Vaccinations and Shelter Details. Each widget owns its own query and
// loading/empty state; the page owns which appointment's detail panel is
// open (Today's Appointments' "View Details"), so it opens right here.
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const [openAppointmentId, setOpenAppointmentId] = useState<number | null>(null);

  const profileQuery = useQuery({
    queryKey: ["vet", "me"],
    queryFn: getMyVetProfile,
  });
  const shelter = profileQuery.data?.shelter;

  const surname = user?.name?.trim().split(/\s+/).pop();
  const greetingName = surname ? formatVetName(surname) : "there";

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${greetingName}`}
        emoji={getGreetingEmoji()}
        message="Here's your schedule and patient updates for today"
        showDate
      />

      <StatsWidget shelterName={shelter?.shelterName} />

      {/* Same fixed min-height per widget as the Staff Overview, so an
          empty card doesn't look squashed next to a full one. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TodaysAppointmentsWidget onViewDetails={setOpenAppointmentId} />
        <OverdueVaccinationsWidget />
        <ShelterDetailsWidget
          shelter={shelter}
          isLoading={profileQuery.isLoading}
        />
      </div>

      <AppointmentDetailPanel
        appointmentID={openAppointmentId}
        onClose={() => setOpenAppointmentId(null)}
      />
    </div>
  );
};

export default Overview;
