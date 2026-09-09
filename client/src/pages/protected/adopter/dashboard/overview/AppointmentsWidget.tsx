// AppointmentsWidget.tsx
// "Appointments" preview widget on the adopter Overview page — the next few
// upcoming vet appointments for the adopter's pets. "View All" leads to
// /adopter/appointments. Appointments are set by the shelter/vet, so there's
// no "schedule" affordance here.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import { getMyAppointments } from "../../../../../logic/api/adoptersApi";

const PREVIEW_LIMIT = 3;

// "5:00 PM" -> ["5:00", "PM"] for the two-line time block.
const splitTime = (iso: string): [string, string] => {
  const parts = new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .split(" ");
  return [parts[0], parts[1] ?? ""];
};

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
            <p className="font-body text-xs text-neutral-gray">
              No upcoming appointments
            </p>
          </div>
        )}

        {!isLoading && upcoming.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcoming.map((appointment) => {
              const [clock, meridiem] = splitTime(appointment.appointmentDate);

              return (
                <li key={appointment.appointmentID}>
                  <DashboardListRow
                    leading={
                      <div className="w-16 shrink-0 text-center">
                        <p className="font-body text-lg font-bold text-neutral-charcoal">
                          {clock}
                        </p>
                        <p className="font-display text-2xl font-light text-neutral-charcoal">
                          {meridiem}
                        </p>
                      </div>
                    }
                    title={`${appointment.pet.petName} - ${appointment.appointmentReason}`}
                    actions={
                      <RowActionButton
                        onClick={() =>
                          navigate(
                            `/adopter/appointments?appointmentID=${appointment.appointmentID}`,
                          )
                        }
                      >
                        View Details
                      </RowActionButton>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default AppointmentsWidget;
