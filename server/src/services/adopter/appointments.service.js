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

module.exports = { listAppointmentsByAdopter };
