// AppointmentsWidget.tsx
// "Appointments" preview widget on the adopter Overview page — the next few
// upcoming vet appointments for the adopter's pets. "View All" leads to
// /adopter/appointments. Appointments are set by the shelter/vet, so there's
// no "schedule" affordance here. Same rows as the full section (shared
// AppointmentsList); "View Details" deep-links into it.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { getMyAppointments } from "../../../../../../logic/api/adoptersApi";
import AppointmentsList from "../../shared/AppointmentsList";

const PREVIEW_LIMIT = 3;

const AppointmentsWidget = () => {
  const navigate = useNavigate();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["adopter", "appointments", { upcoming: true }],
    queryFn: () => getMyAppointments({ upcoming: true }),
  });

  const upcoming = appointments?.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <OverviewWidgetCard
      icon="🗓️"
      title="Appointments"
      action={{ label: "View All", to: "/adopter/appointments" }}
      className="h-96 flex-1"
      isLoading={isLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="No upcoming appointments"
    >
      <AppointmentsList
        appointments={upcoming}
        variant="upcoming"
        onViewDetails={(id) =>
          navigate(`/adopter/appointments?appointmentID=${id}`)
        }
      />
    </OverviewWidgetCard>
  );
};

export default AppointmentsWidget;
