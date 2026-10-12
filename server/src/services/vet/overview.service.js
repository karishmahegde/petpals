const prisma = require("../../config/prisma");
const storage = require("../storage");
const { INACTIVE_PET_STATUSES, overdueLatestDoses } = require("../../utils/vaccinations");

// The vet dashboard Overview's numbers and lists that the other vet endpoints
// don't already give: overdue vaccinations at the vet's shelter and how many
// pets the vet has treated. (Today's appointments come from
// GET /vets/me/appointments.)

const vetShelterID = async (vetID) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID: vetID },
    select: { shelterID: true },
  });
  return vet?.shelterID ?? null;
};

// ——————————————— OVERDUE VACCINATIONS (GET /vets/me/vaccinations/overdue) ———————————————
// Active pets at the vet's shelter, by the shared latest-dose rule
// (utils/vaccinations.js). doseNumber is the dose now due, e.g.
// "FVRCP (Dose 2)". Most overdue first. Not paginated — bounded by one
// shelter's pets.
const listOverdueVaccinations = async (vetID) => {
  const shelterID = await vetShelterID(vetID);
  if (!shelterID) return [];

  const doses = await prisma.vaccinationRecord.findMany({
    where: {
      pet: { shelterID, adoptionStatus: { notIn: INACTIVE_PET_STATUSES } },
    },
    select: {
      petID: true,
      vaccineID: true,
      administeredDate: true,
      dueDate: true,
      vaccine: { select: { vaccineName: true } },
      pet: { select: { petName: true, petPhoto: true } },
    },
    orderBy: { administeredDate: "asc" },
  });

  return overdueLatestDoses(doses).map(({ dose, doseNumber, daysOverdue }) => ({
    petID: dose.petID,
    petName: dose.pet.petName,
    petPhoto: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, dose.pet.petPhoto),
    vaccineID: dose.vaccineID,
    vaccineName: dose.vaccine.vaccineName,
    doseNumber,
    dueDate: dose.dueDate,
    daysOverdue,
  }));
};

// ——————————————— STATS (GET /vets/me/stats) ———————————————
// petsTreated: distinct pets this vet has seen — at any of their appointments
// that has already happened and wasn't cancelled, at whichever shelter.
const getMyStats = async (vetID) => {
  const treated = await prisma.appointment.findMany({
    where: {
      vetID,
      appointmentStatus: { not: "Cancelled" },
      appointmentDate: { lte: new Date() },
    },
    distinct: ["petID"],
    select: { petID: true },
  });
  return { petsTreated: treated.length };
};

module.exports = { listOverdueVaccinations, getMyStats };
