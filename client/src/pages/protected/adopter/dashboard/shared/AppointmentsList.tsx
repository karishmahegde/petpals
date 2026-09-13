// AppointmentsList.tsx
// The adopter's appointment rows — the full Appointments section (upcoming and
// past) hands this a filtered list. Appointments have no adopter-facing
// destructive action, so this uses DashboardListRow directly rather than the
// confirm-then-mutate DashboardActionList (same call as AppointmentsWidget).
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../components/ui/Badge";
import type { AppointmentListItem } from "../../../../../logic/api/adoptersApi";
import {
  formatTime,
  relativeDateBadge,
} from "../../../../../logic/utils/datetime";

interface AppointmentsListProps {
  appointments: AppointmentListItem[];
  onViewDetails: (appointmentID: number) => void;
  /** Past rows render muted; upcoming rows get the default gold tint + badge. */
  variant?: "upcoming" | "past";
}

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
};

const AppointmentsList = ({
  appointments,
  onViewDetails,
  variant = "upcoming",
}: AppointmentsListProps) => (
  <ul className="flex flex-col gap-4">
    {appointments.map((appointment) => {
      const when = new Date(appointment.appointmentDate);
      const badgeLabel = relativeDateBadge(when);

      return (
        <li key={appointment.appointmentID}>
          <DashboardListRow
            className={
              variant === "past" ? "bg-neutral-lightgray" : "bg-gold-lightest"
            }
            leading={
              <div className="w-12 shrink-0 text-center">
                <p className="font-body text-sm font-bold text-neutral-charcoal">
                  {when.toLocaleDateString("en-US", { month: "short" })}
                </p>
                <p className="font-display text-3xl font-light text-neutral-charcoal">
                  {when.getDate()}
                </p>
              </div>
            }
            title={`${appointment.pet.petName} — ${appointment.appointmentReason}`}
            lines={[
              {
                text: `${formatTime(when)} | ${appointment.vet.vetName} | ${appointment.shelter.shelterName}`,
              },
            ]}
            badge={
              variant === "upcoming" && BADGE_TONE[badgeLabel]
                ? { label: badgeLabel, tone: BADGE_TONE[badgeLabel] }
                : undefined
            }
            actions={
              <RowActionButton
                onClick={() => onViewDetails(appointment.appointmentID)}
              >
                View Details
              </RowActionButton>
            }
          />
        </li>
      );
    })}
  </ul>
);

export default AppointmentsList;
