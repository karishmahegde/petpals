const prisma = require("../../config/prisma");
const { listShelterPets } = require("../staff/pets.service");

// ——————————————— LIST (GET /vets/me/pets) ———————————————
// The pets at the vet's own shelter — staff/pets.service.js's shelter-scoped
// core, so the list shape and filters match the Staff Pets tab exactly. No
// shelter → an impossible sentinel, so the list is simply empty (same
// "found nothing" convention as the Staff appointment list).
const listMyShelterPets = async (vetID, filters) => {
  const vet = await prisma.veterinarian.findUnique({
    where: { userID: vetID },
    select: { shelterID: true },
  });
  return listShelterPets(vet?.shelterID ?? -1, filters);
};

module.exports = { listMyShelterPets };
