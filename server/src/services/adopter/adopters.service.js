const prisma = require("../../config/prisma");
const storage = require("../storage");
const { isUniqueViolation } = require("../../utils/prismaErrors");
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
  emailVerified: true,
  lastLoginAt: true,
  accountStatus: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  country: true,
  onboardingComplete: true,
  onboardingStep: true,
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

  return prisma.adopter.update({
    where: { userID },
    data: { onboardingStep: nextStep },
    select: ADOPTER_PROFILE_SELECT,
  });
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
    return await prisma.adopter.update({
      where: { userID },
      data: { onboardingComplete: true, onboardingStep: 7 },
      select: ADOPTER_PROFILE_SELECT,
    });
  } catch (err) {
    if (err.code === "P2025") {
      throw notFound(userID);
    }
    throw err;
  }
};

// ——————————————— CREATE GOVERNMENT ID (POST /adopters/me/government-id) ———————————————

// File extension by accepted MIME type — keeps stored object names sensible.
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// Shape returned to the client. idNumber is masked before it leaves the service.
const GOVERNMENT_ID_SELECT = {
  governmentIDID: true,
  userID: true,
  userType: true,
  idType: true,
  idNumber: true,
  verificationStatus: true,
  documentURL: true,
};

// Show only the last 4 characters of an ID number in responses.
const maskIdNumber = (idNumber) => {
  const tail = idNumber.slice(-4);
  return `${"*".repeat(Math.max(idNumber.length - tail.length, 0))}${tail}`;
};

const alreadySubmitted = () => {
  const err = new Error(
    "A government ID has already been submitted for this adopter",
  );
  err.code = "CONFLICT";
  return err;
};

const createGovernmentId = async (userID, { idType, idNumber, file }) => {
  // Fast path only — the real guarantee is the @@unique([userID, userType])
  // constraint, caught as a unique violation after create() below. A
  // Rejected record is the one exception: the adopter can resubmit, which
  // overwrites that same row (and resets it to Pending) instead of blocking.
  const existing = await prisma.governmentID.findFirst({
    where: { userID, userType: "Adopter" },
    select: { governmentIDID: true, verificationStatus: true, documentURL: true },
  });
  if (existing && existing.verificationStatus !== "Rejected") {
    throw alreadySubmitted();
  }

  const ext = EXT_BY_MIME[file.mimetype] || "bin";
  const objectPath = `adopter/${userID}/id-${Date.now()}.${ext}`;

  await storage.uploadPrivateFile(
    storage.GOVERNMENT_IDS_BUCKET,
    objectPath,
    file.buffer,
    file.mimetype,
  );

  let record;
  try {
    record = existing
      ? await prisma.governmentID.update({
          where: { governmentIDID: existing.governmentIDID },
          data: {
            idType,
            idNumber,
            verificationStatus: "Pending",
            documentURL: objectPath,
          },
          select: GOVERNMENT_ID_SELECT,
        })
      : await prisma.governmentID.create({
          data: {
            userID,
            userType: "Adopter",
            idType,
            idNumber,
            verificationStatus: "Pending",
            documentURL: objectPath,
          },
          select: GOVERNMENT_ID_SELECT,
        });
  } catch (err) {
    // DB write failed after the file landed — remove the orphaned object.
    await storage.deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, objectPath);
    // Lost a race with a concurrent submission — the unique constraint fired.
    if (isUniqueViolation(err)) {
      throw alreadySubmitted();
    }
    throw err;
  }

  // Resubmission replaced the stored file — the previous one is now
  // orphaned. Best-effort, same as the failure-path cleanup above.
  if (existing?.documentURL) {
    await storage.deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, existing.documentURL);
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
};

// ——————————————— GET GOVERNMENT ID (GET /adopters/me/government-id) ———————————————
const getGovernmentId = async (userID) => {
  const record = await prisma.governmentID.findFirst({
    where: { userID, userType: "Adopter" },
    select: GOVERNMENT_ID_SELECT,
  });

  if (!record) {
    const err = new Error("No government ID has been submitted for this adopter");
    err.code = "NOT_FOUND";
    throw err;
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
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
  createGovernmentId,
  getGovernmentId,
  closeAccount,
};
