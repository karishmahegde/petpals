const prisma = require("../config/prisma");

// ——————————————— GET BREEDS ———————————————
// speciesIDs is expected pre-validated (positive integers) by the controller.
// An empty array naturally yields an empty result set — no special-casing needed.
const getBreeds = async (speciesIDs = []) => {
  const breeds = await prisma.breed.findMany({
    where: { speciesID: { in: speciesIDs } },
    orderBy: [{ species: { speciesName: "asc" } }, { breedName: "asc" }],
    select: {
      breedID: true,
      breedName: true,
      species: { select: { speciesName: true } },
    },
  });

  return breeds.map((breed) => ({
    breedID: breed.breedID,
    breedName: breed.breedName,
    speciesName: breed.species.speciesName,
  }));
};

module.exports = { getBreeds };
