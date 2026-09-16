const prisma = require("../../config/prisma");
const { resolveCoordsFromPostalCode } = require("../geocoding");

const notFound = (shelterID) => {
  const err = new Error(`No shelter exists with ID ${shelterID}`);
  err.code = "NOT_FOUND";
  return err;
};

// shelterZIP is the only thing the offline geocoder understands — a rewritten
// shelterAddress can't itself be resolved to coordinates, but its presence in
// an update still triggers this (see updateShelter) in case the new address
// describes a ZIP the caller forgot to also send.
const geocodeZip = (shelterZIP) => {
  const coords = resolveCoordsFromPostalCode(shelterZIP);
  if (!coords) {
    const err = new Error(
      `shelterZIP '${shelterZIP}' could not be resolved to a location`,
    );
    err.code = "BAD_REQUEST";
    throw err;
  }
  return coords;
};

// Prisma has no first-class PostGIS support (shelterLocation is
// `Unsupported("geography")` in schema.prisma), so reading it back — for
// admin edit forms / map display — needs raw SQL too, same as the write side.
// ::geometry is required — ST_X/ST_Y aren't defined for the geography type.
const getShelterWithCoords = async (shelterID) => {
  const rows = await prisma.$queryRaw`
    SELECT
      "shelterID", "shelterName", "shelterAddress", "shelterPhone", "shelterEmail",
      "shelterZIP", "shelterSize", "shelterStatus", "managerStaffID",
      ST_Y(("shelterLocation")::geometry) AS lat,
      ST_X(("shelterLocation")::geometry) AS lng
    FROM "Shelter"
    WHERE "shelterID" = ${shelterID}
  `;
  const row = rows[0];
  if (!row) return null;

  // Raw SQL results aren't auto-typed like Prisma's normal queries.
  return {
    ...row,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
};

// ——————————————— CREATE SHELTER (POST /shelters) ———————————————
// `data` is already validated and whitelisted by the controller. This is the
// only supported way to add a shelter (NF-04) — geocode first so a bad ZIP
// fails before anything is written, and shelterStatus is left unset so the
// schema's own @default(Open) applies.
const createShelter = async (data) => {
  const coords = geocodeZip(data.shelterZIP);

  const shelter = await prisma.shelter.create({ data });

  await prisma.$executeRaw`
    UPDATE "Shelter"
    SET "shelterLocation" = ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)
    WHERE "shelterID" = ${shelter.shelterID}
  `;

  return getShelterWithCoords(shelter.shelterID);
};

// ——————————————— UPDATE SHELTER (PUT /shelters/:id) ———————————————
// `data` is already validated, whitelisted, and non-empty by the controller.
// Re-geocodes only when shelterAddress or shelterZIP is present in `data` —
// matching the rest of the API's "partial update: presence means change"
// convention (see adopters.controller.js updateMe). Geocoding happens before
// any write, and both writes share one transaction, so a bad ZIP or a lost
// race leaves nothing partially applied.
const updateShelter = async (shelterID, data) => {
  const existing = await prisma.shelter.findUnique({
    where: { shelterID },
    select: { shelterZIP: true },
  });
  if (!existing) {
    throw notFound(shelterID);
  }

  const needsRegeocode = "shelterAddress" in data || "shelterZIP" in data;
  const coords = needsRegeocode
    ? geocodeZip(data.shelterZIP ?? existing.shelterZIP)
    : null;

  const operations = [prisma.shelter.update({ where: { shelterID }, data })];
  if (coords) {
    operations.push(prisma.$executeRaw`
      UPDATE "Shelter"
      SET "shelterLocation" = ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)
      WHERE "shelterID" = ${shelterID}
    `);
  }

  try {
    await prisma.$transaction(operations);
  } catch (err) {
    if (err.code === "P2025") {
      // Lost a race with a delete between the findUnique above and this update.
      throw notFound(shelterID);
    }
    throw err;
  }

  return getShelterWithCoords(shelterID);
};

// ——————————————— UPDATE STATUS (PATCH /shelters/:id/status) ———————————————
const updateShelterStatus = async (shelterID, shelterStatus) => {
  try {
    await prisma.shelter.update({
      where: { shelterID },
      data: { shelterStatus },
    });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(shelterID);
    }
    throw err;
  }

  return getShelterWithCoords(shelterID);
};

const staffNotFoundAtShelter = (managerStaffID, shelterID) => {
  const err = new Error(
    `No staff member with ID ${managerStaffID} was found at shelter ${shelterID}`,
  );
  err.code = "NOT_FOUND";
  return err;
};

const deactivatedManager = (managerStaffID) => {
  const err = new Error(
    `Staff member ${managerStaffID} is deactivated and cannot be assigned as manager`,
  );
  err.code = "CONFLICT";
  return err;
};

// ——————————————— UPDATE MANAGER (PATCH /shelters/:id/manager) ———————————————
// Scoped to this shelter — a staff member who exists but works at a
// different shelter fails the same "belongs to this shelter" check as one
// who doesn't exist at all, so both surface as 404.
const updateShelterManager = async (shelterID, managerStaffID) => {
  const shelter = await prisma.shelter.findUnique({
    where: { shelterID },
    select: { shelterID: true },
  });
  if (!shelter) {
    throw notFound(shelterID);
  }

  const staff = await prisma.staff.findFirst({
    where: { userID: managerStaffID, shelterID },
    select: { accountStatus: true },
  });
  if (!staff) {
    throw staffNotFoundAtShelter(managerStaffID, shelterID);
  }
  if (staff.accountStatus === "Deactivated") {
    throw deactivatedManager(managerStaffID);
  }

  await prisma.shelter.update({
    where: { shelterID },
    data: { managerStaffID },
  });

  return getShelterWithCoords(shelterID);
};

module.exports = {
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManager,
};
