// AppointmentDetailPanel.tsx
// Detail slide-over for one of the vet's own appointments, laid out like the
// vet dashboard prototype: pet banner, the appointment's details,
// Appointment Notes, Vaccination (an inline "Record Vaccine" form —
// RecordVaccineForm), Vaccines Administered, and Complete Appointment in the
// footer.
// - Notes: while the appointment can still be completed, a box whose text is
//   saved with Complete (it becomes a health record on the pet, linked to
//   this appointment). Afterwards, the notes already written are listed.
// - Record Vaccine: any status but Cancelled — doses are often written up
//   after the visit.
// - Edit Appointment: while it's still Scheduled and upcoming — swaps the
//   details for EditAppointmentForm (date & time and reason; assignments
//   stay Staff's).
// - Complete Appointment: only while the stored status is still Scheduled,
//   disabled (with the reason) until the appointment's time has come, behind
//   a confirmation. A past Scheduled appointment already *displays* as
//   Completed, which is why this checks the stored `appointmentStatus`.
// Both actions invalidate everything that shows the appointment or the
// pet's health: the appointment lists (tab + Overview share the
// ["vet", "appointments"] prefix), this detail, the health passports, and
// the Overview's overdue-vaccinations list and stats.
// Cancelling stays a Staff action, so there's no Cancel button here.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw, FaPlus } from "react-icons/fa";
import SlideOver from "../../../../../../components/ui/SlideOver";
import Badge, { type BadgeTone } from "../../../../../../components/ui/Badge";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import {
  completeMyAppointment,
  getMyVetAppointment,
} from "../../../../../../logic/api/vetsApi";
import {
  formatFullDate,
  formatShortDate,
  formatTime,
} from "../../../../../../logic/utils/datetime";
import RecordVaccineForm from "./RecordVaccineForm";
import { formatNextDue } from "../../../../../../logic/utils/vaccination";
import EditAppointmentForm from "./EditAppointmentForm";

interface AppointmentDetailPanelProps {
  appointmentID: number | null;
  onClose: () => void;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Scheduled: "gold",
  Completed: "green",
  Cancelled: "red",
};

const MAX_NOTES_LEN = 500; // server: HealthRecord.recordDesc is VarChar(500)

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal text-right";
const sectionTitle = "font-body text-base font-semibold text-neutral-gray";
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
  const [notes, setNotes] = useState("");
  const [showVaccineForm, setShowVaccineForm] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Start every opened appointment clean.
  const [lastOpenedId, setLastOpenedId] = useState(appointmentID);
  if (appointmentID !== lastOpenedId) {
    setLastOpenedId(appointmentID);
    setNotes("");
    setShowVaccineForm(false);
    setConfirmingComplete(false);
    setIsEditing(false);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vet", "appointment", appointmentID],
    queryFn: () => getMyVetAppointment(appointmentID!),
    enabled: appointmentID !== null,
  });

  const refreshAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["vet", "appointments"] });
    queryClient.invalidateQueries({ queryKey: ["vet", "appointment", appointmentID] });
    queryClient.invalidateQueries({ queryKey: ["vet", "health-passport"] });
    queryClient.invalidateQueries({ queryKey: ["vet", "vaccinations"] });
    queryClient.invalidateQueries({ queryKey: ["vet", "stats"] });
  };

  const complete = useMutation({
    mutationFn: () => completeMyAppointment(appointmentID!, notes.trim() || undefined),
    onSuccess: () => {
      refreshAfterChange();
      toast.success("Appointment completed");
      setConfirmingComplete(false);
      setNotes("");
    },
    onError: (err) => {
      setConfirmingComplete(false);
      toast.error(extractError(err));
    },
  });

  const canComplete = data?.appointmentStatus === "Scheduled";
  // Displayed Scheduled = stored Scheduled and still ahead — what's editable.
  const canEdit = data?.status === "Scheduled";
  const timeHasCome = data ? new Date(data.appointmentDate) <= new Date() : false;
  const canVaccinate = data ? data.status !== "Cancelled" : false;

  return (
    <>
      <SlideOver
        open={appointmentID !== null}
        onClose={onClose}
        title="Appointment Details"
        footer={
          data && canComplete ? (
            <div className="flex flex-col gap-2">
              {canEdit && !isEditing && (
                <ButtonElement
                  onClick={() => setIsEditing(true)}
                  size="panel"
                  className="w-full bg-teal-dark hover:brightness-95"
                >
                  Edit Appointment
                </ButtonElement>
              )}
              <ButtonElement
                onClick={() => setConfirmingComplete(true)}
                disabled={!timeHasCome || complete.isPending}
                size="panel"
                className="w-full bg-green hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete Appointment
              </ButtonElement>
              {!timeHasCome && (
                <p className="text-center font-body text-xs text-neutral-gray">
                  Available once the appointment time has come (
                  {formatShortDate(new Date(data.appointmentDate))},{" "}
                  {formatTime(new Date(data.appointmentDate))}).
                </p>
              )}
            </div>
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
            {/* Pet banner */}
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

            {/* Appointment details — date & time and reason swap for the
                edit form while editing */}
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <InfoRow k="Appointment ID" v={data.appointmentCode ? `#${data.appointmentCode}` : "—"} />
              {!isEditing && (
                <>
                  <InfoRow
                    k="Date & time"
                    v={`${formatFullDate(new Date(data.appointmentDate))} | ${formatTime(
                      new Date(data.appointmentDate),
                    )}`}
                  />
                  <InfoRow k="Reason for appointment" v={data.appointmentReason} />
                </>
              )}
              <InfoRow k="Shelter" v={data.shelterName} />
              <InfoRow k="Staff" v={data.staffName ?? "—"} />
              <InfoRow k="Volunteer" v={data.volunteerName ?? "—"} />
            </dl>
            {isEditing && canEdit && (
              <EditAppointmentForm
                appointment={data}
                onSaved={() => {
                  refreshAfterChange();
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
              />
            )}

            {/* Appointment notes */}
            <div className={divider} />
            <h2 className={sectionTitle}>Appointment Notes</h2>
            {data.healthRecords.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {data.healthRecords.map((r) => (
                  <li
                    key={r.recordID}
                    className="rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3"
                  >
                    <p className="font-body text-sm text-neutral-charcoal">{r.recordDesc}</p>
                    <p className="mt-1 font-body text-xs italic text-neutral-gray">
                      {formatShortDate(new Date(r.createdAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canComplete ? (
              <>
                <textarea
                  id="appointment-notes"
                  aria-label="Appointment notes"
                  rows={4}
                  maxLength={MAX_NOTES_LEN}
                  value={notes}
                  disabled={complete.isPending}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Comments"
                  className="mt-3 w-full rounded-xl border border-neutral-lightgray bg-white px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none"
                />
                <p className="mt-1 font-body text-xs text-neutral-gray">
                  Saved to the pet's health passport when you complete the
                  appointment. {notes.length}/{MAX_NOTES_LEN}
                </p>
              </>
            ) : (
              data.healthRecords.length === 0 && (
                <p className="mt-2 font-body text-xs text-neutral-gray">
                  No notes for this appointment.
                </p>
              )
            )}

            {/* Vaccination */}
            {canVaccinate && (
              <>
                <div className={divider} />
                <h2 className={sectionTitle}>Vaccination</h2>
                {!showVaccineForm ? (
                  <ButtonElement
                    onClick={() => setShowVaccineForm(true)}
                    size="bare"
                    className="mt-2 inline-flex items-center gap-2 rounded-md bg-teal-dark px-3 py-1.5 text-sm hover:brightness-95"
                  >
                    <FaPlus className="h-3 w-3" aria-hidden /> Record Vaccine
                  </ButtonElement>
                ) : (
                  <RecordVaccineForm
                    appointmentID={data.appointmentID}
                    appointmentDate={data.appointmentDate}
                    onRecorded={() => {
                      refreshAfterChange();
                      setShowVaccineForm(false);
                    }}
                  />
                )}
              </>
            )}

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
                  <li key={v.recordID} className="flex items-center justify-between gap-3">
                    <span className="font-body text-sm font-semibold text-neutral-charcoal">
                      {v.vaccineName}
                    </span>
                    <span className="font-body text-xs italic text-neutral-gray">
                      Next Due: {formatNextDue(v.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmActionModal
        isOpen={confirmingComplete}
        title="Complete this appointment?"
        confirmLabel="Complete"
        cancelLabel="Not yet"
        isPending={complete.isPending}
        onCancel={() => setConfirmingComplete(false)}
        onConfirm={() => complete.mutate()}
      >
        This marks {data?.pet.petName ?? "this pet"}'s appointment as completed
        {notes.trim()
          ? " and adds your notes to their health passport."
          : ". You haven't written any notes — you can still record vaccinations afterwards."}
      </ConfirmActionModal>
    </>
  );
};

export default AppointmentDetailPanel;
