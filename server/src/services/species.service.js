const prisma = require("../config/prisma");

// ——————————————— GET SPECIES ———————————————
const getSpecies = async () => {
  const species = await prisma.species.findMany({
    orderBy: { speciesName: "asc" },
    select: { speciesID: true, speciesName: true },
  });

  return species;
};

module.exports = { getSpecies };
