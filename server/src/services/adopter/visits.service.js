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

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
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

// ——————————————— VISIT DETAIL (GET /visits/:id) ———————————————
// The record behind one Visits row, for the detail slide-over. Adopter-owned
// only (403 otherwise).
const getVisitDetailForAdopter = async (visitID, adopterID) => {
  const visit = await prisma.visit.findUnique({
    where: { visitID },
    select: {
      visitID: true,
      adopterID: true,
      visitTime: true,
      remarks: true,
      visitStatus: true,
      pet: {
        select: {
          petName: true,
          petPhoto: true,
          breed: {
            select: {
              breedName: true,
              species: { select: { speciesName: true } },
            },
          },
        },
      },
      shelter: { select: { shelterName: true, shelterAddress: true } },
      staff: { select: { staffName: true } },
    },
  });

  if (!visit) {
    throw notFound(`No visit exists with ID ${visitID}`);
  }
  if (visit.adopterID !== adopterID) {
    const err = new Error("You can only view your own visits");
    err.code = "FORBIDDEN";
    throw err;
  }

  const isClosed =
    visit.visitStatus === "Cancelled" || visit.visitStatus === "Completed";

  return {
    visitID: visit.visitID,
    visitTime: visit.visitTime,
    remarks: visit.remarks,
    visitStatus: visit.visitStatus,
    canCancel: !isClosed && visit.visitTime.getTime() > Date.now(),
    pet: visit.pet
      ? {
          petName: visit.pet.petName,
          petPhoto: visit.pet.petPhoto,
          breedName: visit.pet.breed.breedName,
          speciesName: visit.pet.breed.species.speciesName,
        }
      : null,
    shelterName: visit.shelter.shelterName,
    shelterAddress: visit.shelter.shelterAddress,
    assignedStaffName: visit.staff ? visit.staff.staffName : null,
  };
};

// ——————————————— CANCEL VISIT (PATCH /visits/:id) ———————————————
// Adopter-initiated only, and only to 'Cancelled'. Staff confirming or
// completing a visit is separate, later work. A visit that has already
// passed, or is already Cancelled/Completed, can't be cancelled.
const cancelVisit = async (visitID, adopterID) => {
  const visit = await prisma.visit.findUnique({
    where: { visitID },
    select: {
      visitID: true,
      adopterID: true,
      visitStatus: true,
      visitTime: true,
    },
  });

  if (!visit) {
    throw notFound(`No visit exists with ID ${visitID}`);
  }
  if (visit.adopterID !== adopterID) {
    const err = new Error("You can only cancel your own visits");
    err.code = "FORBIDDEN";
    throw err;
  }
  if (visit.visitStatus === "Cancelled") {
    throw conflict("This visit is already cancelled");
  }
  if (visit.visitStatus === "Completed") {
    throw conflict("A completed visit can't be cancelled");
  }
  if (visit.visitTime.getTime() <= Date.now()) {
    throw conflict("A visit in the past can't be cancelled");
  }

  return prisma.visit.update({
    where: { visitID },
    data: { visitStatus: "Cancelled" },
    select: LIST_SELECT,
  });
};

module.exports = {
  createVisit,
  listVisitsByAdopter,
  getVisitDetailForAdopter,
  cancelVisit,
};
