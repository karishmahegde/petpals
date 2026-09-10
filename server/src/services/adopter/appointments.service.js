const prisma = require("../../config/prisma");

// ——————————————— LIST APPOINTMENTS FOR AN ADOPTER (GET /adopters/me/appointments) ———————————————
// Vet appointments for every pet the adopter has an Accepted application for —
// same access rule as the vaccination-history endpoint. Ordered by date
// ascending; `upcomingOnly` narrows to appointments still in the future.
const LIST_SELECT = {
  appointmentID: true,
  appointmentDate: true,
  appointmentReason: true,
  pet: { select: { petID: true, petName: true } },
  shelter: { select: { shelterName: true } },
  vet: { select: { vetName: true } },
};

const listAppointmentsByAdopter = async (
  adopterID,
  { upcomingOnly = false } = {},
) => {
  const where = {
    pet: {
      adoptionApps: { some: { adopterID, applicationStatus: "Accepted" } },
    },
  };
  if (upcomingOnly) {
    where.appointmentDate = { gt: new Date() };
  }

  return prisma.appointment.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { appointmentDate: "asc" },
  });
};

// ——————————————— APPOINTMENT DETAIL (GET /adopters/me/appointments/:id) ———————————————
// The full record behind one row of the Appointments section, for the detail
// slide-over. Same access rule as the list — the adopter must hold an Accepted
// application for the appointment's pet, otherwise 403.
// "Vaccines administered" has no FK to Appointment in the schema, so it's
// approximated as the pet's vaccination records dated the same calendar day as
// the appointment.

// "APT-" + zero-padded appointment ID — the human-facing reference.
const formatAppointmentCode = (id) => `APT-${String(id).padStart(5, "0")}`;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
const nextDay = (date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const getAppointmentDetailForAdopter = async (adopterID, appointmentID) => {
  const appointment = await prisma.appointment.findFirst({
    where: {
      appointmentID,
      pet: {
        adoptionApps: { some: { adopterID, applicationStatus: "Accepted" } },
      },
    },
    select: {
      appointmentID: true,
      appointmentDate: true,
      appointmentReason: true,
      pet: {
        select: {
          petID: true,
          petName: true,
          petPhoto: true,
          breed: {
            select: {
              breedName: true,
              species: { select: { speciesName: true } },
            },
          },
        },
      },
      vet: { select: { vetName: true } },
      shelter: { select: { shelterName: true, shelterAddress: true } },
    },
  });

  if (!appointment) {
    const err = new Error(
      "No such appointment, or it isn't for a pet you've adopted",
    );
    err.code = "NOT_FOUND";
    throw err;
  }

  const vaccines = await prisma.vaccinationRecord.findMany({
    where: {
      petID: appointment.pet.petID,
      administeredDate: {
        gte: startOfDay(appointment.appointmentDate),
        lt: nextDay(appointment.appointmentDate),
      },
    },
    select: {
      recordID: true,
      dueDate: true,
      vaccine: { select: { vaccineName: true } },
    },
    orderBy: { administeredDate: "asc" },
  });

  return {
    appointmentID: appointment.appointmentID,
    appointmentCode: formatAppointmentCode(appointment.appointmentID),
    appointmentDate: appointment.appointmentDate,
    appointmentReason: appointment.appointmentReason,
    pet: {
      petID: appointment.pet.petID,
      petName: appointment.pet.petName,
      petPhoto: appointment.pet.petPhoto,
      breedName: appointment.pet.breed.breedName,
      speciesName: appointment.pet.breed.species.speciesName,
    },
    vetName: appointment.vet ? appointment.vet.vetName : null,
    shelterName: appointment.shelter.shelterName,
    shelterAddress: appointment.shelter.shelterAddress,
    vaccinesAdministered: vaccines.map((v) => ({
      recordID: v.recordID,
      vaccineName: v.vaccine.vaccineName,
      dueDate: v.dueDate,
    })),
  };
};

module.exports = {
  listAppointmentsByAdopter,
  getAppointmentDetailForAdopter,
};
