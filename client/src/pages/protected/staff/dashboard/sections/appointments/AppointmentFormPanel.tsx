// AppointmentFormPanel.tsx
// "New Appointment" form — same shape as the Transfers tab's own
// TransferFormPanel.tsx (SlideOver, a couple of <select>s + a reason
// <textarea>, submit -> create + close). Pet/vet/volunteer options are all
// scoped to this shelter server-side (staffAppointmentsApi.ts's
// getShelterVets/getShelterVolunteers, and the existing getMyShelterPets).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { getMyShelterPets } from "../../../../../../logic/api/staffPetsApi";
import {
  createAppointment,
  getShelterVets,
  getShelterVolunteers,
} from "../../../../../../logic/api/staffAppointmentsApi";

interface AppointmentFormPanelProps {
  open: boolean;
  onClose: () => void;
}

const MAX_REASON_LEN = 300; // schema.prisma: appointmentReason is VarChar(300)

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AppointmentFormPanel = ({ open, onClose }: AppointmentFormPanelProps) => {
  const queryClient = useQueryClient();
  const [petID, setPetID] = useState("");
  const [vetID, setVetID] = useState("");
  const [volunteerID, setVolunteerID] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: petsResult } = useQuery({
    queryKey: ["staff", "shelter-pets", "for-appointment"],
    queryFn: () => getMyShelterPets({ limit: 200 }),
    enabled: open,
  });
  const pets = petsResult?.data ?? [];

  const { data: vets = [] } = useQuery({
    queryKey: ["staff", "shelter-vets"],
    queryFn: getShelterVets,
    enabled: open,
  });

  const { data: volunteers = [] } = useQuery({
    queryKey: ["staff", "shelter-volunteers"],
    queryFn: getShelterVolunteers,
    enabled: open,
  });

  const resetForm = () => {
    setPetID("");
    setVetID("");
    setVolunteerID("");
    setAppointmentDate("");
    setReason("");
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  const submit = useMutation({
    mutationFn: () =>
      createAppointment({
        petID: Number(petID),
        vetID: Number(vetID),
        volunteerID: volunteerID ? Number(volunteerID) : undefined,
        appointmentDate,
        appointmentReason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "appointments-queue"] });
      toast.success("Appointment created");
      closeAndReset();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const canSubmit =
    petID !== "" &&
    vetID !== "" &&
    appointmentDate !== "" &&
    reason.trim() !== "" &&
    reason.length <= MAX_REASON_LEN &&
    !submit.isPending;

  return (
    <SlideOver open={open} onClose={closeAndReset} title="New Appointment">
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit.mutate();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="appointment-pet">
            Pet
          </label>
          <select
            id="appointment-pet"
            required
            value={petID}
            onChange={(e) => setPetID(e.target.value)}
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {pets.map((pet) => (
              <option key={pet.petID} value={pet.petID}>
                {pet.petName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="appointment-vet">
            Vet
          </label>
          <select
            id="appointment-vet"
            required
            value={vetID}
            onChange={(e) => setVetID(e.target.value)}
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {vets.map((vet) => (
              <option key={vet.vetID} value={vet.vetID}>
                {vet.vetName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="appointment-volunteer">
            Volunteer{" "}
            <span className="font-normal text-neutral-gray">(optional)</span>
          </label>
          <select
            id="appointment-volunteer"
            value={volunteerID}
            onChange={(e) => setVolunteerID(e.target.value)}
            className={fieldClass}
          >
            <option value="">- None -</option>
            {volunteers.map((volunteer) => (
              <option key={volunteer.volunteerID} value={volunteer.volunteerID}>
                {volunteer.volunteerName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="appointment-date">
            Date &amp; time
          </label>
          <input
            id="appointment-date"
            type="datetime-local"
            required
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="appointment-reason">
            Reason for appointment
          </label>
          <textarea
            id="appointment-reason"
            required
            rows={3}
            maxLength={MAX_REASON_LEN}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={fieldClass}
          />
        </div>

        <ButtonElement
          type="submit"
          disabled={!canSubmit}
          size="panel"
          className="w-full bg-teal-dark hover:brightness-95 disabled:cursor-not-allowed"
        >
          {submit.isPending ? "Creating…" : "Create Appointment"}
        </ButtonElement>
      </form>
    </SlideOver>
  );
};

export default AppointmentFormPanel;
