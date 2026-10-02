// Self-service government ID — GET/POST /<role>/me/government-id for every
// role that submits one (Adopter, Admin, Staff, Veterinarian). One copy of
// the rules, scoped by userType: same GovernmentID table, same private
// government-ids bucket, one record per user (@@unique([userID, userType])),
// a Rejected record can be resubmitted, and idNumber is masked on BOTH the
// POST and GET responses — never returned in full. Reviewing someone else's
// ID is a different access pattern and lives in staff/governmentIds.service.js.
const prisma = require("../../config/prisma");
const storage = require("../storage");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Per-role storage folder (government-ids/<folder>/<userID>/…) and the noun
// used in error messages.
const OWNERS = {
  Adopter: { folder: "adopter", noun: "adopter" },
  Admin: { folder: "admin", noun: "admin" },
  Staff: { folder: "staff", noun: "staff member" },
  Veterinarian: { folder: "vet", noun: "veterinarian" },
};

// File extension by accepted MIME type — keeps stored object names sensible.
const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// Shape returned to the client. idNumber is masked before it leaves here.
const GOVERNMENT_ID_SELECT = {
  governmentIDID: true,
  userID: true,
  userType: true,
  idType: true,
  idNumber: true,
  verificationStatus: true,
  documentURL: true,
};

const MAX_ID_FIELD_LEN = 45; // schema.prisma: idType / idNumber are VarChar(45)

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// Validates a multipart upload (idType, idNumber, `file` from
// middleware/upload's singleFile("file")) and returns what
// createGovernmentId takes. Throws BAD_REQUEST on bad input.
const parseUpload = (req) => {
  const idType =
    typeof req.body.idType === "string" ? req.body.idType.trim() : "";
  const idNumber =
    typeof req.body.idNumber === "string" ? req.body.idNumber.trim() : "";

  if (!idType || idType.length > MAX_ID_FIELD_LEN) {
    throw badRequest(
      `idType is required and must be at most ${MAX_ID_FIELD_LEN} characters`,
    );
  }
  if (!idNumber || idNumber.length > MAX_ID_FIELD_LEN) {
    throw badRequest(
      `idNumber is required and must be at most ${MAX_ID_FIELD_LEN} characters`,
    );
  }
  if (!req.file) {
    throw badRequest("A document file is required in the 'file' field");
  }

  return {
    idType,
    idNumber,
    file: {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    },
  };
};

// Show only the last 4 characters of an ID number in responses.
const maskIdNumber = (idNumber) => {
  const tail = idNumber.slice(-4);
  return `${"*".repeat(Math.max(idNumber.length - tail.length, 0))}${tail}`;
};

const ownerFor = (userType) => {
  const owner = OWNERS[userType];
  if (!owner) {
    throw new Error(`Unsupported government ID userType: ${userType}`);
  }
  return owner;
};

const alreadySubmitted = (noun) => {
  const err = new Error(
    `A government ID has already been submitted for this ${noun}`,
  );
  err.code = "CONFLICT";
  return err;
};

// ——————————————— POST /<role>/me/government-id ———————————————
const createGovernmentId = async (userType, userID, { idType, idNumber, file }) => {
  const { folder, noun } = ownerFor(userType);

  // Fast path only — the real guarantee is the @@unique([userID, userType])
  // constraint, caught as a unique violation below. A Rejected record is the
  // one exception: the user can resubmit, which overwrites that same row
  // (and resets it to Pending) instead of blocking.
  const existing = await prisma.governmentID.findFirst({
    where: { userID, userType },
    select: { governmentIDID: true, verificationStatus: true, documentURL: true },
  });
  if (existing && existing.verificationStatus !== "Rejected") {
    throw alreadySubmitted(noun);
  }

  const ext = EXT_BY_MIME[file.mimetype] || "bin";
  const objectPath = `${folder}/${userID}/id-${Date.now()}.${ext}`;

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
            userType,
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
      throw alreadySubmitted(noun);
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

// ——————————————— GET /<role>/me/government-id ———————————————
const getGovernmentId = async (userType, userID) => {
  const { noun } = ownerFor(userType);
  const record = await prisma.governmentID.findFirst({
    where: { userID, userType },
    select: GOVERNMENT_ID_SELECT,
  });

  if (!record) {
    const err = new Error(`No government ID has been submitted for this ${noun}`);
    err.code = "NOT_FOUND";
    // Expected on every load before the user has submitted one — the client
    // treats this 404 as a normal "not submitted yet" state, so it shouldn't
    // spam a stack trace to the server console every time.
    err.quiet = true;
    throw err;
  }

  return { ...record, idNumber: maskIdNumber(record.idNumber) };
};

module.exports = { parseUpload, createGovernmentId, getGovernmentId };
