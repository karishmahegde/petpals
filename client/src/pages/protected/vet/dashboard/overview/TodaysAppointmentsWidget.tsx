// TodaysAppointmentsWidget.tsx
// "Today's Appointments" on the vet Overview — every appointment the vet has
// today (useTodaysAppointments), earliest first. "View Details" opens the
// appointment's detail panel on the Overview itself (the page owns which
// one is open); "View All" goes to the Appointments tab.
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import useTodaysAppointments from "./useTodaysAppointments";
import AppointmentRow from "./AppointmentRow";

interface TodaysAppointmentsWidgetProps {
  onViewDetails: (appointmentID: number) => void;
}

const TodaysAppointmentsWidget = ({ onViewDetails }: TodaysAppointmentsWidgetProps) => {
  const { appointments, isLoading } = useTodaysAppointments();

  return (
    <OverviewWidgetCard
      icon="🗓️"
      title="Today's Appointments"
      action={{ label: "View All", to: "/vet/appointments" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={appointments.length === 0}
      emptyMessage="No appointments today"
    >
      <ul className="flex flex-col gap-4">
        {appointments.map((appointment) => (
          <li key={appointment.appointmentID}>
            <AppointmentRow
              appointment={appointment}
              onViewDetails={() => onViewDetails(appointment.appointmentID)}
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default TodaysAppointmentsWidget;
