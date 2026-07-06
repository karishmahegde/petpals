const prisma = require("../config/prisma");

// ——————————————— GET SHELTERS ———————————————
const getShelters = async () => {
  const shelters = await prisma.shelter.findMany({
    where: { shelterStatus: "Open" },
    orderBy: { shelterName: "asc" },
    select: { shelterID: true, shelterName: true },
  });

  return shelters;
};

module.exports = { getShelters };
