// EditAppointmentForm.tsx
// The panel's inline edit for one of the vet's own upcoming appointments —
// date & time and reason, the two things a vet may change
// (PATCH /appointments/:id). Who it's assigned to stays Staff's call. Only
// sends the fields that actually changed.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import {
  updateMyAppointment,
  type VetAppointmentDetail,
} from "../../../../../../logic/api/vetsApi";
import { toDateTimeLocalValue } from "../../../../../../logic/utils/datetime";

interface EditAppointmentFormProps {
  appointment: VetAppointmentDetail;
  onSaved: () => void;
  onCancel: () => void;
}

const MAX_REASON_LEN = 300; // server: appointmentReason is VarChar(300)

const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";
const labelClass = "mb-1 block font-body text-sm font-semibold text-teal-dark";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const EditAppointmentForm = ({ appointment, onSaved, onCancel }: EditAppointmentFormProps) => {
  const initialWhen = toDateTimeLocalValue(new Date(appointment.appointmentDate));
  const [when, setWhen] = useState(initialWhen);
  const [reason, setReason] = useState(appointment.appointmentReason);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateMyAppointment(appointment.appointmentID, {
        ...(when !== initialWhen && { appointmentDate: new Date(when).toISOString() }),
        ...(reason.trim() !== appointment.appointmentReason && {
          appointmentReason: reason.trim(),
        }),
      }),
    onSuccess: () => {
      toast.success("Appointment updated");
      onSaved();
    },
    onError: (err) => setError(extractError(err)),
  });

  const unchanged = when === initialWhen && reason.trim() === appointment.appointmentReason;

  const handleSave = () => {
    if (!when || !reason.trim()) {
      setError("Date & time and reason are both required.");
      return;
    }
    if (new Date(when).getTime() < Date.now()) {
      setError("The new date & time can't be in the past.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="mt-5 flex flex-col gap-4 rounded-xl border border-neutral-lightgray p-4">
      <div>
        <label htmlFor="edit-appointment-when" className={labelClass}>
          Date & time
        </label>
        <input
          id="edit-appointment-when"
          type="datetime-local"
          min={toDateTimeLocalValue(new Date())}
          value={when}
          disabled={mutation.isPending}
          onChange={(e) => setWhen(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="edit-appointment-reason" className={labelClass}>
          Reason for appointment
        </label>
        <textarea
          id="edit-appointment-reason"
          rows={3}
          maxLength={MAX_REASON_LEN}
          value={reason}
          disabled={mutation.isPending}
          onChange={(e) => setReason(e.target.value)}
          className={fieldClass}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <ButtonElement
          onClick={handleSave}
          disabled={mutation.isPending || unchanged}
          size="panel"
          className="flex-1 bg-teal-dark hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Changes"}
        </ButtonElement>
        <ButtonElement
          onClick={onCancel}
          disabled={mutation.isPending}
          size="panel"
          className="flex-1 bg-red hover:brightness-95"
        >
          Cancel
        </ButtonElement>
      </div>
    </div>
  );
};

export default EditAppointmentForm;
