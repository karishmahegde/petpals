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
// ST_Distance - PosGIS function to calculate the distance between 2 geographic points taking into consideration the earth's curvature
// ST_MakePoint - Converts a lat/long pair into an actual geographic point
// ST_SetSRID - Assings the SRID 4326 system - a unit of measurement to the geographic point
// ST_DWithin - Uses an optimized approach to return true/false whether a point lies within the radius
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
    // Raw SQL results aren't auto-typed like Prisma's normal queries, so distance
    // may not be a plain number yet — Number() ensures it is. Round to 2 decimal
    // places using *100/Math.round/100 (not .toFixed, which returns a string)
    // so distance stays a number in the response, not display-formatted text.
    distance: Math.round(Number(shelter.distance) * 100) / 100, //Rounding off to
  }));
};

module.exports = { getShelters, getNearbyShelters };
