const prisma = require("../../config/prisma");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Scalar shape returned to the client for a created application.
const APPLICATION_SELECT = {
  applicationID: true,
  petID: true,
  adopterID: true,
  shelterID: true,
  staffID: true,
  applicationStatus: true,
  applicationType: true,
  shelterMessage: true,
  createdAt: true,
};

// Statuses that mean an application is still in play — a new one cannot be
// submitted for the same pet while one of these exists. A Rejected application
// does not block re-applying.
const ACTIVE_STATUSES = ["Pending", "Accepted"];

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// ——————————————— CREATE APPLICATION (POST /adoption-applications) ———————————————
const createApplication = async ({
  adopterID,
  petID,
  shelterID,
  applicationType,
  shelterMessage,
}) => {
  const pet = await prisma.pet.findUnique({
    where: { petID },
    select: { petID: true, adoptionStatus: true, shelterID: true },
  });

  if (!pet) {
    const err = new Error(`No pet exists with ID ${petID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  if (pet.adoptionStatus !== "available") {
    throw conflict("This pet is not currently available for adoption");
  }

  if (pet.shelterID !== shelterID) {
    const err = new Error("shelterID does not match the pet's shelter");
    err.code = "BAD_REQUEST";
    throw err;
  }

  // Fast path only — the real guarantee is the DB partial unique index on
  // (adopterID, petID) WHERE applicationStatus IN ('Pending','Accepted'),
  // caught as a unique violation after create() below.
  const existing = await prisma.adoptionApplication.findFirst({
    where: { adopterID, petID, applicationStatus: { in: ACTIVE_STATUSES } },
    select: { applicationID: true },
  });
  if (existing) {
    throw conflict("You already have an active application for this pet");
  }

  try {
    return await prisma.adoptionApplication.create({
      data: {
        petID,
        shelterID,
        adopterID,
        applicationStatus: "Pending",
        applicationType,
        shelterMessage,
      },
      select: APPLICATION_SELECT,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflict("You already have an active application for this pet");
    }
    if (err.code === "P2003") {
      const e = new Error(
        "adopterID, petID, or shelterID does not reference an existing record",
      );
      e.code = "BAD_REQUEST";
      throw e;
    }
    throw err;
  }
};

// ——————————————— GET APPLICATION BY ID (GET /adoption-applications/:id) ———————————————
const getApplicationById = async (applicationID, user) => {
  const application = await prisma.adoptionApplication.findUnique({
    where: { applicationID },
    select: {
      ...APPLICATION_SELECT,
      pet: { select: { petName: true } },
      shelter: { select: { shelterName: true } },
    },
  });

  if (!application) {
    const err = new Error(
      `No adoption application exists with ID ${applicationID}`,
    );
    err.code = "NOT_FOUND";
    throw err;
  }

  // Adopters may only see their own applications. Staff may see any.
  if (user.role === "Adopter" && application.adopterID !== user.userID) {
    const err = new Error("You can only view your own adoption applications");
    err.code = "FORBIDDEN";
    throw err;
  }

  return application;
};

// ——————————————— LIST APPLICATIONS FOR AN ADOPTER (GET /adopters/me/applications) ———————————————
const LIST_SELECT = {
  applicationID: true,
  petID: true,
  shelterID: true,
  applicationStatus: true,
  createdAt: true,
  pet: { select: { petName: true, petPhoto: true } },
  shelter: { select: { shelterName: true } },
};

const listApplicationsByAdopter = async (
  adopterID,
  { status, petID, page = 1, limit = 20 } = {},
) => {
  const where = { adopterID };
  if (status) {
    where.applicationStatus = status;
  }
  if (petID !== undefined) {
    where.petID = petID;
  }

  const [data, total] = await Promise.all([
    prisma.adoptionApplication.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adoptionApplication.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— LIST ADOPTED PETS (GET /adopters/me/adopted-pets) ———————————————
// Pets the adopter successfully adopted: their application was Accepted AND the
// pet's own status is now 'adopted'. There's no explicit adoption-completed
// timestamp, so "most recently adopted first" is approximated by the accepted
// application's createdAt.
const listAdoptedPetsByAdopter = async (adopterID) => {
  const rows = await prisma.adoptionApplication.findMany({
    where: {
      adopterID,
      applicationStatus: "Accepted",
      pet: { adoptionStatus: "adopted" },
    },
    select: {
      createdAt: true,
      pet: {
        select: {
          petID: true,
          petName: true,
          petPhoto: true,
          intakeDate: true,
          breed: {
            select: {
              breedName: true,
              species: { select: { speciesName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    petID: row.pet.petID,
    petName: row.pet.petName,
    petPhoto: row.pet.petPhoto,
    breed: row.pet.breed.breedName,
    species: row.pet.breed.species.speciesName,
    intakeDate: row.pet.intakeDate,
  }));
};

module.exports = {
  createApplication,
  getApplicationById,
  listApplicationsByAdopter,
  listAdoptedPetsByAdopter,
};
