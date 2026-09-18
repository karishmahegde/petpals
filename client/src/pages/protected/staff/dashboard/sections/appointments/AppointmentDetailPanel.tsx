// AppointmentDetailPanel.tsx
// Detail slide-over for one appointment — mirrors the adopter dashboard's
// own sections/appointments/AppointmentDetailPanel.tsx layout exactly (pet
// summary banner, InfoRow dl, Vaccines Administered list), adding a status
// Badge, Staff/Volunteer rows, an Adopter Details section, and a
// Cancel-Appointment footer action (only while still Scheduled/upcoming).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import {
  getAppointmentDetail,
  cancelAppointment,
} from "../../../../../../logic/api/staffAppointmentsApi";
import SlideOver from "../../../../../../components/ui/SlideOver";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../../../../../../logic/utils/datetime";

interface AppointmentDetailPanelProps {
  appointmentID: number | null;
  onClose: () => void;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Scheduled: "gold",
  Completed: "green",
  Cancelled: "red",
};

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

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AppointmentDetailPanel = ({
  appointmentID,
  onClose,
}: AppointmentDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "appointment", appointmentID],
    queryFn: () => getAppointmentDetail(appointmentID!),
    enabled: appointmentID !== null,
  });

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(appointmentID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "appointments-queue"] });
      queryClient.invalidateQueries({
        queryKey: ["staff", "appointment", appointmentID],
      });
      toast.success("Appointment cancelled");
      setIsCancelOpen(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <>
      <SlideOver
        open={appointmentID !== null}
        onClose={onClose}
        title="Appointment Details"
        footer={
          data?.status === "Scheduled" ? (
            <ButtonElement
              onClick={() => setIsCancelOpen(true)}
              size="panel"
              variant="outline"
              className="w-full border border-rose-dark text-rose-dark hover:bg-rose-dark hover:text-white"
            >
              Cancel Appointment
            </ButtonElement>
          ) : undefined
        }
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
              <Badge tone={STATUS_TONE[data.status]} className="shrink-0">
                {data.status}
              </Badge>
            </div>

            {/* Appointment info */}
            <dl className="mt-5 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Appointment ID" v={data.appointmentCode ?? "—"} />
              <InfoRow
                k="Date & time"
                v={`${formatFullDate(new Date(data.appointmentDate))} · ${formatTime(
                  new Date(data.appointmentDate),
                )}`}
              />
              <InfoRow k="Reason for appointment" v={data.appointmentReason} />
              <InfoRow k="Shelter" v={data.shelterName} />
              <InfoRow k="Vet" v={data.vetName} />
              <InfoRow k="Staff" v={data.staffName ?? "—"} />
              <InfoRow k="Volunteer" v={data.volunteerName ?? "—"} />
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

            {/* Adopter details */}
            <div className={divider} />
            <h2 className={sectionTitle}>Adopter Details</h2>
            {data.adopter ? (
              <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2">
                <InfoRow k="Name" v={data.adopter.adopterName} />
                <InfoRow k="Phone" v={data.adopter.adopterPhone ?? "—"} />
                <InfoRow k="Email" v={data.adopter.adopterEmail} />
                <InfoRow k="Address" v={data.adopter.address || "—"} />
              </dl>
            ) : (
              <p className="mt-2 font-body text-xs text-neutral-gray">
                This pet has no adopter yet.
              </p>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={isCancelOpen}
        title="Cancel this appointment?"
        confirmLabel="Cancel Appointment"
        isPending={cancel.isPending}
        onCancel={() => setIsCancelOpen(false)}
        onConfirm={() => cancel.mutate()}
      >
        This cancels {data?.pet.petName ?? "this"}'s appointment with Dr.{" "}
        {data?.vetName}. This can't be undone.
      </ConfirmActionModal>
    </>
  );
};

export default AppointmentDetailPanel;
