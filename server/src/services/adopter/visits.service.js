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

// ——————————————— LIST VISITS FOR STAFF/ADMIN (GET /visits) ———————————————
// Shelter-wide visit queue, distinct from listVisitsByAdopter above (which is
// a single adopter's own visits). Includes the adopter/pet summary, since
// staff are managing visits booked by many different adopters. Same
// Staff-scoped-to-own-shelter / Admin-optionally-filtered convention as
// listApplicationsForStaff in adoptionApplications.service.js.
const STAFF_LIST_SELECT = {
  ...VISIT_SELECT,
  pet: { select: { petName: true } }, // null when petID is not set
  adopter: {
    select: {
      adopterName: true,
      user: { select: { userEmail: true } },
    },
  },
  staff: { select: { staffName: true } }, // null until Confirmed/Completed
};

const listVisitsForStaff = async (
  { role, userID },
  { upcomingOnly = false, shelterID, page = 1, limit = 20 } = {},
) => {
  const where = {};
  if (upcomingOnly) {
    where.visitTime = { gt: new Date() };
  }

  if (role === "Staff") {
    // Re-fetched fresh from the STAFF table on every call — shelterID is not
    // in the JWT payload. No shelter assigned yet -> a sentinel that can
    // never match, so the result is an empty list rather than an error
    // (same "searched, found nothing" convention the public catalog's
    // location filter and listApplicationsForStaff both use).
    const staff = await prisma.staff.findUnique({
      where: { userID },
      select: { shelterID: true },
    });
    where.shelterID = staff?.shelterID ?? -1;
  } else if (shelterID !== undefined) {
    where.shelterID = shelterID;
  }

  const [data, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      select: STAFF_LIST_SELECT,
      orderBy: { visitTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.visit.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— UPDATE VISIT STATUS (PATCH /visits/:id) ———————————————
// One endpoint, two unrelated actors — matches the
// adoptionApplications.service.js updateApplicationStatus design: which
// transitions are valid depends on the caller's role, not a shared enum.
// Adopter may only move their own, still-future, non-closed visit to
// 'Cancelled'. Staff/Admin may move an unconfirmed (null) visit to
// 'Confirmed', then a 'Confirmed' visit to 'Completed' — Staff only at their
// own shelter (403 otherwise); Admin any shelter. staffID is only ever set
// for a genuine Staff actor (FKs Staff.userID, which an Admin doesn't have),
// same as staffID on AdoptionApplication.
const describeStatus = (visitStatus) =>
  visitStatus === null ? "unconfirmed" : visitStatus.toLowerCase();

const updateVisitStatus = async (visitID, { visitStatus }, actor) => {
  const visit = await prisma.visit.findUnique({
    where: { visitID },
    select: {
      visitID: true,
      adopterID: true,
      shelterID: true,
      visitStatus: true,
      visitTime: true,
    },
  });

  if (!visit) {
    throw notFound(`No visit exists with ID ${visitID}`);
  }

  let actingStaffID = null;

  if (actor.role === "Adopter") {
    if (visit.adopterID !== actor.userID) {
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
  } else {
    // Staff or Admin — controller has already restricted `visitStatus` to
    // Confirmed/Completed for this branch.
    if (actor.role === "Staff") {
      const staff = await prisma.staff.findUnique({
        where: { userID: actor.userID },
        select: { shelterID: true },
      });
      if (visit.shelterID !== staff?.shelterID) {
        const err = new Error("You may only act on visits at your own shelter");
        err.code = "FORBIDDEN";
        throw err;
      }
      actingStaffID = actor.userID;
    }
    // Admin: no shelter restriction.

    if (visitStatus === "Confirmed" && visit.visitStatus !== null) {
      throw conflict(
        `A ${describeStatus(visit.visitStatus)} visit can't be confirmed`,
      );
    }
    if (visitStatus === "Completed" && visit.visitStatus !== "Confirmed") {
      throw conflict(
        `A ${describeStatus(visit.visitStatus)} visit can't be completed`,
      );
    }
  }

  const data = { visitStatus };
  if (actingStaffID !== null) {
    data.staffID = actingStaffID;
  }

  return prisma.visit.update({
    where: { visitID },
    data,
    select: LIST_SELECT,
  });
};

module.exports = {
  createVisit,
  listVisitsByAdopter,
  listVisitsForStaff,
  getVisitDetailForAdopter,
  updateVisitStatus,
};
