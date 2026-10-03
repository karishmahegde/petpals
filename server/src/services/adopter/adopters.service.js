const prisma = require("../../config/prisma");
const storage = require("../storage");
const { nullifyRefreshToken } = require("../auth/auth.service");

// The public shape of an adopter profile — shared by GET and PUT /adopters/me so
// both responses stay identical. stripeCustomerID is intentionally omitted —
// never exposed in API responses.
const ADOPTER_PROFILE_SELECT = {
  userID: true,
  avatarSeed: true,
  adopterName: true,
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
  accountStatus: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  country: true,
  onboardingComplete: true,
  onboardingStep: true,
  // Account-level, on Users — flattened back onto the profile by
  // toAdopterProfile so the response shape is unchanged.
  user: { select: { emailVerified: true, lastLoginAt: true } },
};

const toAdopterProfile = ({ user, ...rest }) => ({
  ...rest,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
});

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

  return toAdopterProfile(adopter);
};

// ——————————————— UPDATE ADOPTER PROFILE (PUT /adopters/me) ———————————————
// `data` is already validated and whitelisted by the controller.
const updateAdopterProfile = async (userID, data) => {
  try {
    return toAdopterProfile(
      await prisma.adopter.update({
        where: { userID },
        data,
        select: ADOPTER_PROFILE_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      // error codes sent by prisma
      throw notFound(userID); // no adopter row for this user
    }
    if (err.code === "P2003") {
      // error codes sent by prisma
      // FK violation — preferredBreedID points at a missing row
      const e = new Error(
        "preferredBreedID does not reference an existing record",
      );
      e.code = "BAD_REQUEST";
      throw e;
    }
    throw err;
  }
};

// ——————————————— ADVANCE ONBOARDING STEP (PATCH /adopters/me/onboarding-step) ———————————————
// `step` is the wizard step the adopter just completed (2-6, validated by
// the controller). Never moves onboardingStep backward, regardless of what
// the client sends — the persisted value only ever advances.
const advanceOnboardingStep = async (userID, step) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID },
    select: { onboardingStep: true },
  });
  if (!adopter) {
    throw notFound(userID);
  }

  const nextStep = Math.min(Math.max(adopter.onboardingStep, step + 1), 7);

  return toAdopterProfile(
    await prisma.adopter.update({
      where: { userID },
      data: { onboardingStep: nextStep },
      select: ADOPTER_PROFILE_SELECT,
    }),
  );
};

// ——————————————— COMPLETE ONBOARDING (PATCH /adopters/me/onboarding-complete) ———————————————
// Fields collected across Steps 2, 4 and 5 that must actually be filled in —
// checked server-side, not just trusted from the wizard's own client-side
// required-field checks, since this endpoint could otherwise be hit directly
// with none of them ever having been set. Step 6 (Preferences) is
// intentionally excluded — every field there is a soft preference, not
// required data (see PreferencesStep.tsx).
const REQUIRED_FOR_COMPLETION = {
  adopterDOB: "Date of birth",
  adopterSex: "Sex",
  adopterPhone: "Phone",
  addressLine1: "Address line 1",
  city: "City",
  state: "State",
  zip: "ZIP",
  country: "Country",
  housingType: "Housing type",
  ownsOrRents: "Owns or rents",
  householdSize: "Household size",
  numChildren: "Number of children",
  employmentStatus: "Employment status",
  activityLevel: "Activity level",
  petExperience: "Pet experience",
};

const incompleteOnboarding = (missingLabels) => {
  const err = new Error(
    `Onboarding is incomplete — missing: ${missingLabels.join(", ")}`,
  );
  err.code = "CONFLICT";
  return err;
};

const completeOnboarding = async (userID) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID },
    select: Object.fromEntries(
      Object.keys(REQUIRED_FOR_COMPLETION).map((field) => [field, true]),
    ),
  });
  if (!adopter) {
    throw notFound(userID);
  }

  const missingLabels = Object.entries(REQUIRED_FOR_COMPLETION)
    .filter(([field]) => {
      const value = adopter[field];
      return value === null || value === undefined || value === "";
    })
    .map(([, label]) => label);

  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Adopter" },
    select: { governmentIDID: true },
  });
  if (!governmentId) {
    missingLabels.push("Government ID");
  }

  if (missingLabels.length > 0) {
    throw incompleteOnboarding(missingLabels);
  }

  try {
    return toAdopterProfile(
      await prisma.adopter.update({
        where: { userID },
        data: { onboardingComplete: true, onboardingStep: 7 },
        select: ADOPTER_PROFILE_SELECT,
      }),
    );
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }
};

// ——————————————— CLOSE ACCOUNT (DELETE /adopters/me) ———————————————

const activeAdoptionConflict = () => {
  const err = new Error(
    "You have an active adoption on record and can't deactivate or delete your account. Contact support if you believe this is an error.",
  );
  err.code = "CONFLICT";
  return err;
};

// Adopters who are the caretaker of record for a pet must stay reachable —
// this guard applies to both deactivate and delete.
const assertNoActiveAdoption = async (userID) => {
  const accepted = await prisma.adoptionApplication.findFirst({
    where: { adopterID: userID, applicationStatus: "Accepted" },
    select: { applicationID: true },
  });
  if (accepted) {
    throw activeAdoptionConflict();
  }
};

const closeAccount = async (userID, mode) => {
  await assertNoActiveAdoption(userID);

  if (mode === "deactivate") {
    await prisma.$transaction([
      prisma.adopter.update({
        where: { userID },
        data: { accountStatus: "Deactivated" },
      }),
      nullifyRefreshToken(prisma, userID),
    ]);
    return;
  }

  // mode === "delete" — capture the government ID's stored file path (if any)
  // before the transaction so the Storage cleanup can happen afterward; a
  // network call has no place inside a DB transaction.
  const governmentId = await prisma.governmentID.findFirst({
    where: { userID, userType: "Adopter" },
    select: { documentURL: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.governmentID.deleteMany({ where: { userID, userType: "Adopter" } });
    await tx.favorite.deleteMany({ where: { adopterID: userID } });
    await tx.visit.deleteMany({ where: { adopterID: userID } });
    await tx.adoptionApplication.deleteMany({ where: { adopterID: userID } });
    await tx.adopter.delete({ where: { userID } });
    await tx.users.delete({ where: { userID } });
  });

  if (governmentId?.documentURL) {
    await storage.deletePrivateFile(
      storage.GOVERNMENT_IDS_BUCKET,
      governmentId.documentURL,
    );
  }
};

module.exports = {
  getAdopterProfile,
  updateAdopterProfile,
  advanceOnboardingStep,
  completeOnboarding,
  closeAccount,
};
