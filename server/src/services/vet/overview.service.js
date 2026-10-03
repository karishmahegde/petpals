const prisma = require("../../config/prisma");
const storage = require("../storage");

// The vet dashboard Overview's numbers and lists that the other vet endpoints
// don't already give: overdue vaccinations at the vet's shelter and how many
// pets the vet has treated. (Today's appointments come from
// GET /vets/me/appointments.)

const DAY_MS = 24 * 60 * 60 * 1000;

// Pets that are still the shelter's to look after — an adopted pet's
// boosters are its adopter's vet's business, and a deceased one has none.
const INACTIVE_PET_STATUSES = ["adopted", "deceased"];

const vetShelterID = async (vetID) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID: vetID },
    select: { shelterID: true },
  });
  return vet?.shelterID ?? null;
};

// ——————————————— OVERDUE VACCINATIONS (GET /vets/me/vaccinations/overdue) ———————————————
// For each active pet at the vet's shelter and each vaccine it has had, only
// the LATEST dose counts: it's overdue when its next-due date has passed. A
// latest dose with no due date (no further dose planned) is never overdue.
// An older dose whose booster was since given isn't overdue. doseNumber is
// the dose now due (doses given + 1), e.g. "FVRCP (Dose 2)". Most overdue
// first. Not paginated — bounded by one shelter's pets.
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

  // Ascending by administeredDate, so the last one per pet+vaccine wins.
  const latest = new Map();
  const counts = new Map();
  for (const dose of doses) {
    const key = `${dose.petID}:${dose.vaccineID}`;
    latest.set(key, dose);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const now = Date.now();
  return [...latest.entries()]
    .filter(([, dose]) => dose.dueDate && dose.dueDate.getTime() < now)
    .map(([key, dose]) => ({
      petID: dose.petID,
      petName: dose.pet.petName,
      petPhoto: storage.toPublicFileUrl(storage.PET_IMAGES_BUCKET, dose.pet.petPhoto),
      vaccineID: dose.vaccineID,
      vaccineName: dose.vaccine.vaccineName,
      doseNumber: counts.get(key) + 1,
      dueDate: dose.dueDate,
      daysOverdue: Math.floor((now - dose.dueDate.getTime()) / DAY_MS),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
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
