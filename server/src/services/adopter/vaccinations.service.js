const prisma = require("../../config/prisma");

// ——————————————— LIST PET VACCINATIONS FOR AN ADOPTER ———————————————
// GET /adopters/me/adopted-pets/:petId/vaccinations — read-only view of a pet's
// vaccination history, available only to an adopter with an Accepted application
// for that pet.
const listPetVaccinationsForAdopter = async (adopterID, petID) => {
  const acceptedApp = await prisma.adoptionApplication.findFirst({
    where: { adopterID, petID, applicationStatus: "Accepted" },
    select: { applicationID: true },
  });
  if (!acceptedApp) {
    const err = new Error(
      "You can only view vaccination history for pets you have adopted",
    );
    err.code = "FORBIDDEN";
    throw err;
  }

  const records = await prisma.vaccinationRecord.findMany({
    where: { petID },
    select: {
      recordID: true,
      administeredDate: true,
      dueDate: true,
      vaccine: { select: { vaccineName: true } },
      vet: { select: { vetName: true } }, // nullable — administeredBy may be unset
    },
    orderBy: { administeredDate: "desc" },
  });

  return records.map((r) => ({
    recordID: r.recordID,
    vaccineName: r.vaccine.vaccineName,
    administeredDate: r.administeredDate,
    dueDate: r.dueDate,
    vetName: r.vet ? r.vet.vetName : null,
  }));
};

module.exports = { listPetVaccinationsForAdopter };
