// RecordVaccineForm.tsx
// The panel's inline "Record Vaccine" form: vaccine (GET /vaccines) and an
// optional next due date → POST /appointments/:id/vaccinations. Leaving the
// date blank records that no further dose is planned (never overdue). The dose's administered
// date isn't asked for: it's the appointment's own date once that has
// passed (the usual case — written up during or after the visit), or now if
// it's being recorded ahead of it. The server fills in the pet, the vet, the
// shelter and the appointment link.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import {
  getVaccines,
  recordVaccination,
} from "../../../../../../logic/api/vaccinationsApi";

interface RecordVaccineFormProps {
  appointmentID: number;
  appointmentDate: string;
  onRecorded: () => void;
}

const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none";
const labelClass = "mb-1 block font-body text-sm font-semibold text-neutral-dark";

// <input type="date"> works in local YYYY-MM-DD.
const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const RecordVaccineForm = ({
  appointmentID,
  appointmentDate,
  onRecorded,
}: RecordVaccineFormProps) => {
  const [vaccineID, setVaccineID] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vaccinesQuery = useQuery({ queryKey: ["vaccines"], queryFn: getVaccines });

  // When the dose counts as given — see the header note.
  const administeredAt = () => {
    const scheduled = new Date(appointmentDate);
    return scheduled <= new Date() ? scheduled : new Date();
  };

  const mutation = useMutation({
    mutationFn: () =>
      recordVaccination(appointmentID, {
        vaccineID: Number(vaccineID),
        administeredDate: administeredAt().toISOString(),
        // Local midnight of the chosen day; null = no further dose planned.
        dueDate: dueDate ? new Date(`${dueDate}T00:00`).toISOString() : null,
      }),
    onSuccess: (dose) => {
      toast.success(`${dose.vaccineName} recorded`);
      setVaccineID("");
      setDueDate("");
      onRecorded();
    },
    onError: (err) => setError(extractError(err)),
  });

  // The next dose can't be due on or before the day this one is given.
  const minDue = (() => {
    const day = administeredAt();
    day.setDate(day.getDate() + 1);
    return toDateInput(day);
  })();

  const handleAdd = () => {
    if (!vaccineID) {
      setError("Pick a vaccine.");
      return;
    }
    if (dueDate && dueDate < minDue) {
      setError("The next due date must be after the day this dose is given.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <label htmlFor="record-vaccine" className={labelClass}>
          Vaccine Name
        </label>
        <select
          id="record-vaccine"
          value={vaccineID}
          disabled={mutation.isPending || !vaccinesQuery.data}
          onChange={(e) => setVaccineID(e.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>
            {vaccinesQuery.isLoading ? "Loading…" : "Select Vaccine"}
          </option>
          {(vaccinesQuery.data ?? []).map((v) => (
            <option key={v.vaccineID} value={v.vaccineID}>
              {v.vaccineName}
            </option>
          ))}
        </select>
        {vaccinesQuery.isError && (
          <p className="mt-1 font-body text-xs text-rose-dark">
            Couldn't load the vaccine list.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="record-due-date" className={labelClass}>
          Next Due Date{" "}
          <span className="font-normal text-neutral-gray">(optional)</span>
        </label>
        <input
          id="record-due-date"
          type="date"
          min={minDue}
          value={dueDate}
          disabled={mutation.isPending}
          onChange={(e) => setDueDate(e.target.value)}
          className={fieldClass}
        />
        <p className="mt-1 font-body text-xs text-neutral-gray">
          Leave blank if no further dose is planned.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <ButtonElement
        onClick={handleAdd}
        disabled={mutation.isPending}
        size="panel"
        className="w-full bg-rose-dark hover:brightness-95 disabled:opacity-50"
      >
        {mutation.isPending ? "Adding…" : "Add Vaccine"}
      </ButtonElement>
    </div>
  );
};

export default RecordVaccineForm;
