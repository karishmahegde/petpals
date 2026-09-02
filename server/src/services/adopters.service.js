const prisma = require("../config/prisma");

// ——————————————— GET ADOPTER PROFILE (/adopters/me) ———————————————
const getAdopterProfile = async (userID) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID },
    select: {
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
      // stripeCustomerID intentionally excluded — never exposed in API responses
    },
  });

  if (!adopter) {
    const err = new Error(`No adopter exists with ID ${userID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  return adopter;
};

module.exports = { getAdopterProfile };
