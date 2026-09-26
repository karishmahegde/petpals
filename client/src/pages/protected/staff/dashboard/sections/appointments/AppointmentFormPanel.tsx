// AppointmentFormPanel.tsx
// "New Appointment" form — same shape as the Transfers tab's own
// TransferFormPanel.tsx (SlideOver, a couple of <select>s + a reason
// <textarea>, submit -> create + close). Pet/vet/staff/volunteer options are
// all scoped to this shelter server-side (staffAppointmentsApi.ts's
// getShelterVets/getShelterStaff/getShelterVolunteers, and the existing
// getMyShelterPets). Staff defaults to the logged-in staff member.
// Also the Edit form: pass `appointment` (from AppointmentDetailPanel's Edit)
// and every field is seeded from it, with Pet locked — the caller remounts
// this per target via `key`, so the useState initialisers below are the only
// seeding needed. Edit sends just the changed fields to PATCH.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { getMyShelterPets } from "../../../../../../logic/api/staffPetsApi";
import {
  createAppointment,
  getShelterStaff,
  getShelterVets,
  getShelterVolunteers,
  updateAppointment,
  type AppointmentDetail,
  type UpdateAppointmentPayload,
} from "../../../../../../logic/api/staffAppointmentsApi";
import useAuthStore from "../../../../../../logic/store/useAuthStore";
import { toDateTimeLocalValue } from "../../../../../../logic/utils/datetime";
import { formatVetName } from "../../../../../../logic/utils/vetName";

interface AppointmentFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode, seeded from this appointment. */
  appointment?: AppointmentDetail | null;
}

const MAX_REASON_LEN = 300; // schema.prisma: appointmentReason is VarChar(300)

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

const readOnlyFieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-neutral-offwhite px-3 py-2.5 font-body text-sm text-neutral-gray focus:outline-none";

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const idToString = (id: number | null | undefined) =>
  id === null || id === undefined ? "" : String(id);

const AppointmentFormPanel = ({
  open,
  onClose,
  appointment = null,
}: AppointmentFormPanelProps) => {
  const queryClient = useQueryClient();
  const isEdit = appointment !== null;
  const currentUserID = useAuthStore((s) => s.user?.userID);
  const defaultStaffID = currentUserID ? String(currentUserID) : "";

  // Seed values — the create defaults, or the appointment being edited.
  const initial = {
    petID: idToString(appointment?.pet.petID),
    vetID: idToString(appointment?.vetID),
    staffID: isEdit ? idToString(appointment.staffID) : defaultStaffID,
    volunteerID: idToString(appointment?.volunteerID),
    appointmentDate: appointment
      ? toDateTimeLocalValue(new Date(appointment.appointmentDate))
      : "",
    reason: appointment?.appointmentReason ?? "",
  };

  const [petID, setPetID] = useState(initial.petID);
  const [vetID, setVetID] = useState(initial.vetID);
  const [staffID, setStaffID] = useState(initial.staffID);
  const [volunteerID, setVolunteerID] = useState(initial.volunteerID);
  const [appointmentDate, setAppointmentDate] = useState(initial.appointmentDate);
  const [reason, setReason] = useState(initial.reason);

  const { data: petsResult } = useQuery({
    queryKey: ["staff", "shelter-pets", "for-appointment"],
    queryFn: () => getMyShelterPets({ limit: 200 }),
    enabled: open && !isEdit,
  });
  const pets = petsResult?.data ?? [];

  const { data: vets = [] } = useQuery({
    queryKey: ["staff", "shelter-vets"],
    queryFn: getShelterVets,
    enabled: open,
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["staff", "shelter-staff"],
    queryFn: getShelterStaff,
    enabled: open,
  });

  const { data: volunteers = [] } = useQuery({
    queryKey: ["staff", "shelter-volunteers"],
    queryFn: getShelterVolunteers,
    enabled: open,
  });

  const resetForm = () => {
    setPetID(initial.petID);
    setVetID(initial.vetID);
    setStaffID(initial.staffID);
    setVolunteerID(initial.volunteerID);
    setAppointmentDate(initial.appointmentDate);
    setReason(initial.reason);
  };

  const closeAndReset = () => {
    resetForm();
    onClose();
  };

  // Only what actually changed goes to PATCH.
  const buildChanges = (): UpdateAppointmentPayload => {
    const changes: UpdateAppointmentPayload = {};
    if (vetID !== initial.vetID) changes.vetID = Number(vetID);
    if (staffID !== initial.staffID) changes.staffID = Number(staffID);
    if (volunteerID !== initial.volunteerID) {
      changes.volunteerID = volunteerID ? Number(volunteerID) : null;
    }
    if (appointmentDate !== initial.appointmentDate) {
      changes.appointmentDate = new Date(appointmentDate).toISOString();
    }
    if (reason.trim() !== initial.reason) changes.appointmentReason = reason.trim();
    return changes;
  };
  const hasChanges = !isEdit || Object.keys(buildChanges()).length > 0;

  const submit = useMutation({
    mutationFn: () =>
      isEdit
        ? updateAppointment(appointment.appointmentID, buildChanges())
        : createAppointment({
            petID: Number(petID),
            vetID: Number(vetID),
            staffID: Number(staffID),
            volunteerID: volunteerID ? Number(volunteerID) : undefined,
            // Explicit ISO so the server doesn't read the naive
            // datetime-local string in its own timezone.
            appointmentDate: new Date(appointmentDate).toISOString(),
            appointmentReason: reason.trim(),
          }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "appointments-queue"] });
      if (isEdit) {
        queryClient.setQueryData(["staff", "appointment", saved.appointmentID], saved);
      }
      toast.success(isEdit ? "Appointment updated" : "Appointment created");
      closeAndReset();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const canSubmit =
    hasChanges &&
    petID !== "" &&
    vetID !== "" &&
    staffID !== "" &&
    appointmentDate !== "" &&
    reason.trim() !== "" &&
    reason.length <= MAX_REASON_LEN &&
    !submit.isPending;

  return (
    <SlideOver
      open={open}
      onClose={closeAndReset}
      title={isEdit ? "Edit Appointment" : "New Appointment"}
    >
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
          {isEdit ? (
            // A different pet is a different appointment — cancel + create.
            <input
              id="appointment-pet"
              readOnly
              value={appointment.pet.petName}
              className={readOnlyFieldClass}
            />
          ) : (
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
          )}
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
                {formatVetName(vet.vetName)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="appointment-staff">
            Staff
          </label>
          <select
            id="appointment-staff"
            required
            value={staffID}
            onChange={(e) => setStaffID(e.target.value)}
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {staffMembers.map((member) => (
              <option key={member.staffID} value={member.staffID}>
                {member.staffName}
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
          {isEdit
            ? submit.isPending
              ? "Saving…"
              : "Save Changes"
            : submit.isPending
              ? "Creating…"
              : "Create Appointment"}
        </ButtonElement>
      </form>
    </SlideOver>
  );
};

export default AppointmentFormPanel;
