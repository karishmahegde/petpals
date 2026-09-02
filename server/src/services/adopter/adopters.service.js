const prisma = require("../../config/prisma");
const storage = require("../storage");
const { isUniqueViolation } = require("../../utils/prismaErrors");

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
  // Fast path only — avoids an unnecessary file upload in the common case.
  // The real guarantee is the @@unique([userID, userType]) constraint, caught
  // as a unique violation after create() below.
  const existing = await prisma.governmentID.findFirst({
    where: { userID, userType: "Adopter" },
    select: { governmentIDID: true },
  });
  if (existing) {
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
    record = await prisma.governmentID.create({
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

module.exports = {
  getAdopterProfile,
  updateAdopterProfile,
  createGovernmentId,
  getGovernmentId,
};
