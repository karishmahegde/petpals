const prisma = require("../config/prisma");

// Scalar shape returned to the client for a created application.
const APPLICATION_SELECT = {
  applicationID: true,
  petID: true,
  adopterID: true,
  shelterID: true,
  staffID: true,
  applicationStatus: true,
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
const createApplication = async ({ adopterID, petID, shelterID }) => {
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

  const existing = await prisma.adoptionApplication.findFirst({
    where: { adopterID, petID, applicationStatus: { in: ACTIVE_STATUSES } },
    select: { applicationID: true },
  });
  if (existing) {
    throw conflict("You already have an active application for this pet");
  }

  try {
    return await prisma.adoptionApplication.create({
      data: { petID, shelterID, adopterID, applicationStatus: "Pending" },
      select: APPLICATION_SELECT,
    });
  } catch (err) {
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

module.exports = { createApplication };
