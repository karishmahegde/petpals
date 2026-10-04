// AppointmentsWidget.tsx
// "Assisting Appointments" on the volunteer Overview — upcoming vet
// appointments staff have assigned the volunteer to assist (GET
// /volunteers/me/appointments?upcoming=true), soonest first. Read-only;
// "View All" goes to the Appointments tab.
import { useQuery } from "@tanstack/react-query";
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { DashboardListRow } from "../../../../../components/ui/dashboard/DashboardList";
import { formatTime } from "../../../../../logic/utils/datetime";
import { formatVetName } from "../../../../../logic/utils/vetName";
import { upcomingAppointmentsQuery } from "./overviewQueries";
import DateBlock from "../shared/DateBlock";

const AppointmentsWidget = () => {
  const { data, isLoading } = useQuery(upcomingAppointmentsQuery);
  const appointments = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="🩺"
      title="Assisting Appointments"
      action={{ label: "View All", to: "/volunteer/appointments" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={appointments.length === 0}
      emptyMessage="No upcoming appointments to assist with"
    >
      <ul className="flex flex-col gap-4">
        {appointments.map((appointment) => (
          <li key={appointment.appointmentID}>
            <DashboardListRow
              className="bg-rose-lightest"
              leading={<DateBlock iso={appointment.appointmentDate} />}
              title={`${appointment.pet.petName} - ${appointment.appointmentReason}`}
              lines={[
                {
                  text: `${formatTime(new Date(appointment.appointmentDate))} | ${formatVetName(
                    appointment.vetName,
                  )}`,
                },
              ]}
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default AppointmentsWidget;
