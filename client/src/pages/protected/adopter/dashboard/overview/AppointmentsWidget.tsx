// AppointmentsWidget.tsx
// "Appointments" preview widget on the adopter Overview page — the next few
// upcoming vet appointments for the adopter's pets. "View All" leads to
// /adopter/appointments. Appointments are set by the shelter/vet, so there's
// no "schedule" affordance here. Same rows as the full section (shared
// AppointmentsList); "View Details" deep-links into it.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../components/ui/dashboard/DashboardEmptyMessage";
import { getMyAppointments } from "../../../../../logic/api/adoptersApi";
import AppointmentsList from "../shared/AppointmentsList";

const PREVIEW_LIMIT = 3;

const AppointmentsWidget = () => {
  const navigate = useNavigate();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["adopter", "appointments", { upcoming: true }],
    queryFn: () => getMyAppointments({ upcoming: true }),
  });

  const upcoming = appointments?.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <Card className="flex h-96 flex-1 flex-col p-5">
      <DashboardWidgetHeader
        icon="🗓️"
        title="Appointments"
        action={{ label: "View All", to: "/adopter/appointments" }}
      />

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}

        {!isLoading && upcoming.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <DashboardEmptyMessage>
              No upcoming appointments
            </DashboardEmptyMessage>
          </div>
        )}

        {!isLoading && upcoming.length > 0 && (
          <AppointmentsList
            appointments={upcoming}
            variant="upcoming"
            onViewDetails={(id) =>
              navigate(`/adopter/appointments?appointmentID=${id}`)
            }
          />
        )}
      </div>
    </Card>
  );
};

export default AppointmentsWidget;
