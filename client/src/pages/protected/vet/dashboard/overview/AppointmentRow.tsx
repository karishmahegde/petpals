// AppointmentRow.tsx
// One row of the vet Overview's Today's Appointments: the time, pet +
// reason, and View Details (the page opens AppointmentDetailPanel).
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { AppointmentQueueItem } from "../../../../../logic/api/staffAppointmentsApi";
import { formatTime } from "../../../../../logic/utils/datetime";

interface AppointmentRowProps {
  appointment: AppointmentQueueItem;
  onViewDetails: () => void;
}

const AppointmentRow = ({ appointment, onViewDetails }: AppointmentRowProps) => {
  const [time, meridiem] = formatTime(new Date(appointment.appointmentDate)).split(" ");

  return (
    <DashboardListRow
      className="bg-gold-lightest"
      leading={
        <div className="w-14 shrink-0 text-center">
          <p className="font-body text-sm font-bold text-neutral-charcoal">{time}</p>
          <p className="font-body text-xs text-neutral-gray">{meridiem}</p>
        </div>
      }
      title={`${appointment.pet.petName} - ${appointment.appointmentReason}`}
      actions={<RowActionButton onClick={onViewDetails}>View Details</RowActionButton>}
    />
  );
};

export default AppointmentRow;
