// AppointmentDetailPanel.tsx
// Detail slide-over for one vet appointment — opened from the Appointments tab
// (and deep-linked via ?appointmentID from the Overview widget). Mirrors
// PetDetailPanel: this component only fetches + renders, the generic SlideOver
// owns the chrome.
import { useQuery } from "@tanstack/react-query";
import { FaPaw } from "react-icons/fa";
import { getAppointmentDetail } from "../../../../../logic/api/adoptersApi";
import SlideOver from "../../../../../components/ui/SlideOver";
import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../../../../../logic/utils/datetime";

interface AppointmentDetailPanelProps {
  appointmentID: number | null;
  onClose: () => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionTitle = "font-display text-lg text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const AppointmentDetailPanel = ({
  appointmentID,
  onClose,
}: AppointmentDetailPanelProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["adopter", "appointment", appointmentID],
    queryFn: () => getAppointmentDetail(appointmentID!),
    enabled: appointmentID !== null,
  });

  return (
    <SlideOver
      open={appointmentID !== null}
      onClose={onClose}
      title="Appointment Details"
    >
      {isLoading && (
        <p className="p-8 text-center text-sm text-neutral-gray">
          Loading appointment…
        </p>
      )}
      {isError && (
        <p className="p-8 text-center text-sm text-rose-dark">
          Couldn't load this appointment. Please try again.
        </p>
      )}

      {data && (
        <div className="p-6">
          {/* Pet summary */}
          <div className="flex items-center gap-4 rounded-xl border-2 border-gold bg-gold-lightest p-4">
            {data.pet.petPhoto ? (
              <img
                src={data.pet.petPhoto}
                alt={`${data.pet.petName} photo`}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-teal-dark"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite ring-2 ring-teal-dark">
                <FaPaw className="h-6 w-6 text-rose-md" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-body font-bold text-neutral-charcoal">
                {data.pet.petName}
              </p>
              <p className="truncate text-xs text-neutral-gray">
                {data.pet.breedName} · {data.pet.speciesName}
              </p>
            </div>
          </div>

          {/* Appointment info */}
          <dl className="mt-5 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
            <InfoRow k="Appointment ID" v={`#${data.appointmentCode}`} />
            <InfoRow
              k="Date & time"
              v={`${formatFullDate(new Date(data.appointmentDate))} · ${formatTime(
                new Date(data.appointmentDate),
              )}`}
            />
            <InfoRow k="Reason for appointment" v={data.appointmentReason} />
            <InfoRow k="Vet" v={data.vetName ?? "—"} />
            <InfoRow k="Shelter" v={data.shelterName} />
          </dl>

          {/* Vaccines administered */}
          <div className={divider} />
          <h2 className={sectionTitle}>Vaccines Administered</h2>
          {data.vaccinesAdministered.length === 0 ? (
            <p className="mt-2 font-body text-xs text-neutral-gray">
              No vaccines recorded for this appointment.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {data.vaccinesAdministered.map((v) => (
                <li
                  key={v.recordID}
                  className="flex items-center justify-between rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3"
                >
                  <span className="font-body text-sm font-semibold text-neutral-charcoal">
                    {v.vaccineName}
                  </span>
                  <span className="font-body text-xs italic text-neutral-gray">
                    Next due {formatShortDate(new Date(v.dueDate))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SlideOver>
  );
};

export default AppointmentDetailPanel;
