const prisma = require("../../config/prisma");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Staff/Admin-side write counterpart to public/species.service.js and
// public/breeds.service.js (which stay read-only, powering the catalog's
// filter dropdowns). Names are compared case-insensitively so "Labrador"
// and "labrador" can't both exist — checked up front for a clean 409, and
// again via the unique-index catch below in case the DB has the matching
// hand-applied indexes (CLAUDE.md's manual-constraints convention) and two
// requests race.

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— CREATE SPECIES (POST /species) ———————————————
const createSpecies = async ({ speciesName }) => {
  const existing = await prisma.species.findFirst({
    where: { speciesName: { equals: speciesName, mode: "insensitive" } },
    select: { speciesID: true },
  });
  if (existing) {
    throw conflict(`A species named "${speciesName}" already exists`);
  }

  try {
    return await prisma.species.create({
      data: { speciesName },
      select: { speciesID: true, speciesName: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(`A species named "${speciesName}" already exists`);
    }
    throw err;
  }
};

// ——————————————— CREATE BREED (POST /breeds) ———————————————
// Same response shape as public GET /breeds' items, so the client can drop
// it straight into a cached breed list.
const createBreed = async ({ speciesID, breedName }) => {
  const species = await prisma.species.findUnique({
    where: { speciesID },
    select: { speciesName: true },
  });
  if (!species) {
    throw notFound(`No species exists with ID ${speciesID}`);
  }

  const existing = await prisma.breed.findFirst({
    where: {
      speciesID,
      breedName: { equals: breedName, mode: "insensitive" },
    },
    select: { breedID: true },
  });
  if (existing) {
    throw conflict(
      `A ${species.speciesName} breed named "${breedName}" already exists`,
    );
  }

  try {
    const breed = await prisma.breed.create({
      data: { speciesID, breedName },
      select: { breedID: true, breedName: true },
    });
    return { ...breed, speciesName: species.speciesName };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict(
        `A ${species.speciesName} breed named "${breedName}" already exists`,
      );
    }
    throw err;
  }
};

module.exports = { createSpecies, createBreed };
