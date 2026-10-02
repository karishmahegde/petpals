const prisma = require("../../config/prisma");

// Vaccine catalog (GET /vaccines) and the doses given at an appointment
// (GET/POST /appointments/:id/vaccinations) — the first write path into
// VaccinationRecord outside the seed. Doses recorded here are what the
// appointment details' "Vaccines administered" and the pet's Health Passport
// read back.

const notFound = (message) => {
  const err = new Error(message);
  err.code = "NOT_FOUND";
  return err;
};

const appointmentNotFound = (appointmentID) =>
  notFound(`No appointment exists with ID ${appointmentID}`);

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// ——————————————— CATALOG (GET /vaccines) ———————————————
const listVaccines = () =>
  prisma.vaccine.findMany({
    select: { vaccineID: true, vaccineName: true, manufacturer: true, vaccineDesc: true },
    orderBy: { vaccineName: "asc" },
  });

const DOSE_SELECT = {
  recordID: true,
  appointmentID: true,
  administeredDate: true,
  dueDate: true,
  vaccine: { select: { vaccineID: true, vaccineName: true } },
  vet: { select: { vetName: true } },
  shelter: { select: { shelterName: true } },
};

const formatDose = (r) => ({
  recordID: r.recordID,
  appointmentID: r.appointmentID,
  vaccineID: r.vaccine.vaccineID,
  vaccineName: r.vaccine.vaccineName,
  administeredDate: r.administeredDate,
  dueDate: r.dueDate,
  vetName: r.vet ? r.vet.vetName : null,
  shelterName: r.shelter ? r.shelter.shelterName : null,
});

// Loads the appointment the caller may act on, or throws. A vet only ever
// sees their own appointments — another vet's answers exactly like a
// missing one (404), same as GET /vets/me/appointments/:id and completing.
// Staff are limited to their own shelter (403, same as the Staff appointment
// routes); Admin sees every shelter.
const loadAppointmentFor = async ({ role, userID }, appointmentID) => {
  const appointment = await prisma.appointment.findFirst({
    where: {
      appointmentID,
      ...(role === "Veterinarian" ? { vetID: userID } : {}),
    },
    select: { petID: true, shelterID: true, appointmentStatus: true },
  });
  if (!appointment) {
    throw appointmentNotFound(appointmentID);
  }

  if (role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID },
      select: { shelterID: true },
    });
    if (staff?.shelterID !== appointment.shelterID) {
      throw forbidden("You may only act on appointments at your own shelter");
    }
  }

  return appointment;
};

// ——————————————— LIST DOSES (GET /appointments/:id/vaccinations) ———————————————
const listAppointmentVaccinations = async (actor, appointmentID) => {
  await loadAppointmentFor(actor, appointmentID);
  const rows = await prisma.vaccinationRecord.findMany({
    where: { appointmentID },
    select: DOSE_SELECT,
    orderBy: { administeredDate: "asc" },
  });
  return rows.map(formatDose);
};

// ——————————————— RECORD A DOSE (POST /appointments/:id/vaccinations) ———————————————
// Only the appointment's assigned vet (enforced by loadAppointmentFor's
// vetID scoping). Any status but Cancelled — doses are often written up
// after the appointment has been completed. dueDate may be null (no further
// dose planned). petID, administeredBy,
// administeredAt and appointmentID all come from the appointment and the
// caller, never the body. Dates are already validated by the controller.
const recordVaccination = async (vetID, appointmentID, { vaccineID, administeredDate, dueDate }) => {
  const appointment = await loadAppointmentFor(
    { role: "Veterinarian", userID: vetID },
    appointmentID,
  );
  if (appointment.appointmentStatus === "Cancelled") {
    throw conflict("Doses can't be recorded for a Cancelled appointment");
  }

  const vaccine = await prisma.vaccine.findUnique({
    where: { vaccineID },
    select: { vaccineID: true },
  });
  if (!vaccine) {
    throw notFound(`No vaccine exists with ID ${vaccineID}`);
  }

  const record = await prisma.vaccinationRecord.create({
    data: {
      petID: appointment.petID,
      vaccineID,
      administeredDate,
      dueDate,
      administeredBy: vetID,
      administeredAt: appointment.shelterID,
      appointmentID,
    },
    select: DOSE_SELECT,
  });
  return formatDose(record);
};

module.exports = { listVaccines, listAppointmentVaccinations, recordVaccination };
