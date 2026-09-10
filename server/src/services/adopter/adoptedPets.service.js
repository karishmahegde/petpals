const prisma = require("../../config/prisma");
const { formatSex } = require("../public/pets.service");

// ——————————————— ADOPTED-PET DETAIL (GET /adopters/me/adopted-pets/:petId) ———————————————
// One consolidated payload for the My Pets side panel: basic details, intake,
// compatibility, health history (vaccinations + upcoming vet appointments), and
// the adoption record. Same access rule as the vaccination-history endpoint —
// the adopter must hold an Accepted application for this pet, otherwise 403.

// Long-form age for the panel ("5 months", "1 year", "2 years, 3 months").
// Display only — never used for filtering.
const formatAgeLong = (dob) => {
  const today = new Date();
  const dobDate = new Date(dob);
  let totalMonths =
    (today.getFullYear() - dobDate.getFullYear()) * 12 +
    (today.getMonth() - dobDate.getMonth());
  if (today.getDate() < dobDate.getDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const part = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

  if (years === 0) return part(months, "month");
  if (months === 0) return part(years, "year");
  return `${part(years, "year")}, ${part(months, "month")}`;
};

const getAdoptedPetDetailForAdopter = async (adopterID, petID) => {
  const acceptedApp = await prisma.adoptionApplication.findFirst({
    where: { adopterID, petID, applicationStatus: "Accepted" },
    select: {
      createdAt: true,
      shelterMessage: true,
      staffRemark: true,
      shelter: { select: { shelterName: true, shelterAddress: true } },
    },
  });
  if (!acceptedApp) {
    const err = new Error(
      "You can only view details for pets you have adopted",
    );
    err.code = "FORBIDDEN";
    throw err;
  }

  const [pet, vaccinationRecords, appointments] = await Promise.all([
    prisma.pet.findUnique({
      where: { petID },
      select: {
        petID: true,
        petCode: true,
        petName: true,
        petPhoto: true,
        petDOB: true,
        petSex: true,
        petColor: true,
        petSize: true,
        petHeight: true,
        petWeight: true,
        petBGroup: true,
        petDesc: true,
        microchipID: true,
        adoptionStatus: true,
        compatibleWithChildren: true,
        compatibleWithPets: true,
        specialNeeds: true,
        breed: {
          select: {
            breedName: true,
            species: { select: { speciesName: true } },
          },
        },
      },
    }),
    prisma.vaccinationRecord.findMany({
      where: { petID },
      select: {
        recordID: true,
        administeredDate: true,
        dueDate: true,
        vaccine: { select: { vaccineName: true } },
        vet: { select: { vetName: true } },
      },
      orderBy: { administeredDate: "desc" },
    }),
    // Only upcoming appointments here — the full past-and-future history lives
    // on the Appointments section; the panel just surfaces what's next.
    prisma.appointment.findMany({
      where: { petID, appointmentDate: { gt: new Date() } },
      select: {
        appointmentID: true,
        appointmentDate: true,
        appointmentReason: true,
        vet: { select: { vetName: true } },
        shelter: { select: { shelterName: true } },
      },
      orderBy: { appointmentDate: "asc" },
    }),
  ]);

  if (!pet) {
    const err = new Error(`No pet exists with ID ${petID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  return {
    petID: pet.petID,
    petCode: pet.petCode,
    petName: pet.petName,
    petPhoto: pet.petPhoto,
    microchipID: pet.microchipID,
    petAge: formatAgeLong(pet.petDOB),
    petDOB: pet.petDOB,
    petSex: formatSex(pet.petSex),
    petColor: pet.petColor,
    petSize: pet.petSize,
    petHeight: pet.petHeight,
    petWeight: pet.petWeight,
    petBGroup: pet.petBGroup,
    petDesc: pet.petDesc,
    adoptionStatus: pet.adoptionStatus,
    breed: {
      breedName: pet.breed.breedName,
      speciesName: pet.breed.species.speciesName,
    },
    compatibility: {
      children: pet.compatibleWithChildren,
      otherPets: pet.compatibleWithPets,
      specialNeeds: pet.specialNeeds,
    },
    health: {
      vaccinations: vaccinationRecords.map((r) => ({
        recordID: r.recordID,
        vaccineName: r.vaccine.vaccineName,
        administeredDate: r.administeredDate,
        dueDate: r.dueDate,
        vetName: r.vet ? r.vet.vetName : null,
      })),
      appointments: appointments.map((a) => ({
        appointmentID: a.appointmentID,
        appointmentDate: a.appointmentDate,
        appointmentReason: a.appointmentReason,
        vetName: a.vet ? a.vet.vetName : null,
        shelterName: a.shelter ? a.shelter.shelterName : null,
      })),
    },
    adoption: {
      // No adoption-completed timestamp in the schema — the Accepted
      // application's createdAt is the closest marker (date + time).
      adoptedOn: acceptedApp.createdAt,
      shelterName: acceptedApp.shelter.shelterName,
      shelterAddress: acceptedApp.shelter.shelterAddress,
      yourMessage: acceptedApp.shelterMessage,
      staffRemark: acceptedApp.staffRemark,
    },
  };
};

module.exports = { getAdoptedPetDetailForAdopter };
