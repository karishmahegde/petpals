const prisma = require("../config/prisma");

// The public shape of an adopter profile — shared by GET and PUT /adopters/me so
// both responses stay identical. stripeCustomerID is intentionally omitted —
// never exposed in API responses.
const ADOPTER_PROFILE_SELECT = {
  userID: true,
  adopterName: true,
  shelterID: true,
  adopterDOB: true,
  adopterSex: true,
  createdAt: true,
  adopterRiskFlag: true,
  preQualifyFlag: true,
  adopterPhone: true,
  housingType: true,
  ownsOrRents: true,
  landlordContact: true,
  householdSize: true,
  numChildren: true,
  employmentStatus: true,
  activityLevel: true,
  yardAvailable: true,
  petExperience: true,
  currentPets: true,
  preferredBreedID: true,
  preferredAgeRange: true,
  preferredSize: true,
  openToSpecialNeeds: true,
  adopterType: true,
  emailVerified: true,
  lastLoginAt: true,
  accountStatus: true,
};

const notFound = (userID) => {
  const err = new Error(`No adopter exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

// ——————————————— GET ADOPTER PROFILE (/adopters/me) ———————————————
const getAdopterProfile = async (userID) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID },
    select: ADOPTER_PROFILE_SELECT,
  });

  if (!adopter) {
    throw notFound(userID);
  }

  return adopter;
};

// ——————————————— UPDATE ADOPTER PROFILE (PUT /adopters/me) ———————————————
// `data` is already validated and whitelisted by the controller.
const updateAdopterProfile = async (userID, data) => {
  try {
    return await prisma.adopter.update({
      where: { userID },
      data,
      select: ADOPTER_PROFILE_SELECT,
    });
  } catch (err) {
    if (err.code === "P2025") {
      // error codes sent by prisma
      throw notFound(userID); // no adopter row for this user
    }
    if (err.code === "P2003") {
      // error codes sent by prisma
      // FK violation — shelterID or preferredBreedID points at a missing row
      const e = new Error(
        "shelterID or preferredBreedID does not reference an existing record",
      );
      e.code = "BAD_REQUEST";
      throw e;
    }
    throw err;
  }
};

module.exports = { getAdopterProfile, updateAdopterProfile };
