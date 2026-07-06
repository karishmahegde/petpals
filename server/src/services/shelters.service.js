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

// ——————————————— GET /shelters/nearby ———————————————
// Prisma doesn't support PostGIS natively, so raw SQL is required for the
// ST_Distance / ST_DWithin geography operations against shelterLocation.
const getNearbyShelters = async (lat, lng, radius) => {
  const shelters = await prisma.$queryRaw`
    SELECT
      "shelterID",
      "shelterName",
      "shelterAddress",
      "shelterZIP",
      ST_Distance(
        "shelterLocation",
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      ) / 1000 AS distance
    FROM "Shelter"
    WHERE "shelterStatus" = 'Open'
      AND ST_DWithin(
        "shelterLocation",
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        ${radius * 1000}
      )
    ORDER BY distance ASC
  `;

  return shelters.map((shelter) => ({
    ...shelter,
    distance: Math.round(Number(shelter.distance) * 100) / 100,
  }));
};

module.exports = { getShelters, getNearbyShelters };
