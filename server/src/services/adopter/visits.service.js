const prisma = require("../../config/prisma");

// Scalar shape returned to the client for a created visit.
const VISIT_SELECT = {
  visitID: true,
  adopterID: true,
  petID: true,
  staffID: true,
  shelterID: true,
  visitTime: true,
  remarks: true,
  visitStatus: true,
};

const notFound = (message) => {
  const err = new Error(message);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— CREATE VISIT (POST /visits) ———————————————
const createVisit = async ({
  adopterID,
  shelterID,
  petID,
  visitTime,
  remarks,
}) => {
  const shelter = await prisma.shelter.findUnique({
    where: { shelterID },
    select: { shelterID: true },
  });
  if (!shelter) {
    throw notFound(`No shelter exists with ID ${shelterID}`);
  }

  // petID is optional (a plain shelter visit has no pet). Validate it only when
  // supplied, so a bad reference is a clean 404 rather than an FK error.
  if (petID != null) {
    const pet = await prisma.pet.findUnique({
      where: { petID },
      select: { petID: true },
    });
    if (!pet) {
      throw notFound(`No pet exists with ID ${petID}`);
    }
  }

  return prisma.visit.create({
    data: {
      adopterID,
      shelterID,
      petID: petID ?? null,
      visitTime,
      remarks: remarks ?? null,
    },
    select: VISIT_SELECT,
  });
};

// ——————————————— LIST VISITS FOR AN ADOPTER (GET /adopters/me/visits) ———————————————
const LIST_SELECT = {
  ...VISIT_SELECT,
  shelter: { select: { shelterName: true } },
  pet: { select: { petName: true } }, // null when petID is not set
};

const listVisitsByAdopter = async (adopterID, { upcomingOnly = false } = {}) => {
  const where = { adopterID };
  if (upcomingOnly) {
    where.visitTime = { gt: new Date() };
  }

  return prisma.visit.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { visitTime: "asc" },
  });
};

module.exports = { createVisit, listVisitsByAdopter };
