const petsService = require("../../services/staff/pets.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const PET_SEX_VALUES = ["M", "F"]; // live DB column is character(1) — see schema.prisma's petSex note
const PET_SIZE_VALUES = ["Small", "Medium", "Large"];

const STRING_MAX = {
  petName: 45,
  petColor: 45,
  petBGroup: 5,
  microchipID: 45,
  petDesc: 500,
};

// Required on create. The ticket listed breedID/petDOB/petSex/petColor/
// petSize/intakeDate as POST's required set and framed petWeight/petHeight
// as PUT-only additions — but both are NOT NULL in schema.prisma with no
// default, so omitting them on create would either 500 on a raw DB
// constraint violation or need a meaningless placeholder value. Required
// here instead, along with petName (also NOT NULL, no default, and clearly
// needed for the pet to be usable — omitted from the ticket's list too,
// most likely an oversight rather than an intentional "defaults to
// something" design, unlike petBGroup below).
const CREATE_REQUIRED_FIELDS = [
  "breedID",
  "petName",
  "petDOB",
  "petSex",
  "petColor",
  "petSize",
  "intakeDate",
  "petWeight",
  "petHeight",
];

// PUT accepts a partial update of everything creatable, minus shelterID
// (reassigning a pet to another shelter is a transfer, not a profile edit —
// out of scope here), plus the ticket's explicit PUT-only additions.
// petBGroup is deliberately NOT in CREATE_REQUIRED_FIELDS even though it's
// also NOT NULL with no default — unlike petName/petWeight/petHeight, a
// blood group is routinely unknown at shelter intake, so it defaults to
// "N/A" (matching the existing seed-data convention) when omitted on
// create, and can be filled in later via PUT.
const UPDATABLE_FIELDS = [
  "breedID",
  "petName",
  "petDOB",
  "petSex",
  "petColor",
  "petSize",
  "intakeDate",
  "petWeight",
  "petHeight",
  "petBGroup",
  "petDesc",
  "microchipID",
  "featuredFlag",
];

// Shared by create (every required field present) and update (only present
// fields are checked) so the two routes can't drift on what counts as valid.
const validateField = (field, rawValue) => {
  switch (field) {
    case "breedID":
      if (!Number.isInteger(rawValue) || rawValue < 1) {
        throw badRequest("breedID must be a positive integer");
      }
      return rawValue;

    case "petName":
    case "petColor":
      if (
        typeof rawValue !== "string" ||
        rawValue.trim().length === 0 ||
        rawValue.length > STRING_MAX[field]
      ) {
        throw badRequest(
          `${field} must be a non-empty string of at most ${STRING_MAX[field]} characters`,
        );
      }
      return rawValue.trim();

    case "petBGroup":
      if (typeof rawValue !== "string" || rawValue.length > STRING_MAX.petBGroup) {
        throw badRequest(
          `petBGroup must be a string of at most ${STRING_MAX.petBGroup} characters`,
        );
      }
      return rawValue.trim();

    case "microchipID":
      if (rawValue === null) return null; // clearable
      if (typeof rawValue !== "string" || rawValue.length > STRING_MAX.microchipID) {
        throw badRequest(
          `microchipID must be a string of at most ${STRING_MAX.microchipID} characters`,
        );
      }
      return rawValue.trim();

    case "petDesc":
      if (rawValue === null) return null; // clearable
      if (typeof rawValue !== "string" || rawValue.length > STRING_MAX.petDesc) {
        throw badRequest(
          `petDesc must be a string of at most ${STRING_MAX.petDesc} characters`,
        );
      }
      return rawValue.trim();

    case "petSex":
      if (!PET_SEX_VALUES.includes(rawValue)) {
        throw badRequest(`petSex must be one of: ${PET_SEX_VALUES.join(", ")}`);
      }
      return rawValue;

    case "petSize":
      if (!PET_SIZE_VALUES.includes(rawValue)) {
        throw badRequest(`petSize must be one of: ${PET_SIZE_VALUES.join(", ")}`);
      }
      return rawValue;

    case "petDOB":
    case "intakeDate": {
      const parsed = new Date(rawValue);
      if (Number.isNaN(parsed.getTime())) {
        throw badRequest(`${field} must be a valid date`);
      }
      return parsed;
    }

    case "petWeight":
    case "petHeight":
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
        throw badRequest(`${field} must be a positive number`);
      }
      return rawValue;

    case "featuredFlag":
      if (typeof rawValue !== "boolean") {
        throw badRequest("featuredFlag must be a boolean");
      }
      return rawValue;

    default:
      return rawValue;
  }
};

// ——————————————— POST /pets ———————————————
const createPet = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const missing = CREATE_REQUIRED_FIELDS.filter((field) => !(field in body));
  if (missing.length > 0) {
    return next(badRequest(`Missing required field(s): ${missing.join(", ")}`));
  }

  const data = {};
  // petBGroup is optional on create (defaults to "N/A" — see UPDATABLE_FIELDS
  // comment) but still validated if the caller does send it.
  const fieldsToValidate = body.petBGroup !== undefined
    ? [...CREATE_REQUIRED_FIELDS, "petBGroup"]
    : CREATE_REQUIRED_FIELDS;
  try {
    for (const field of fieldsToValidate) {
      data[field] = validateField(field, body[field]);
    }
  } catch (err) {
    return next(err);
  }
  if (!("petBGroup" in data)) {
    data.petBGroup = "N/A";
  }

  // Staff always creates at their own shelter — shelterID isn't even read
  // from the body for that role, let alone required. Admin has no home
  // shelter of their own, so it's required and validated here.
  let requestedShelterID;
  if (req.user.role === "Admin") {
    requestedShelterID = Number(body.shelterID);
    if (!Number.isInteger(requestedShelterID) || requestedShelterID < 1) {
      return next(badRequest("shelterID is required and must be a positive integer"));
    }
  }

  try {
    const pet = await petsService.createPet({
      data,
      actor: { role: req.user.role, userID: req.user.userID },
      requestedShelterID,
    });
    return successResponse(res, "Pet created successfully", pet, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /pets/:id ———————————————
const updatePet = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const data = {};
  try {
    for (const field of UPDATABLE_FIELDS) {
      if (!(field in body)) continue; // partial update — only touch provided fields
      data[field] = validateField(field, body[field]);
    }
  } catch (err) {
    return next(err);
  }

  if (Object.keys(data).length === 0) {
    return next(badRequest("No updatable fields provided"));
  }

  try {
    const pet = await petsService.updatePet(petID, data, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Pet updated successfully", pet);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /pets/:id ———————————————
const deletePet = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    await petsService.deletePet(petID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Pet deleted successfully", null);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /pets/:id/photos ———————————————
// The shared upload middleware (middleware/upload.js's singleFile) also
// allows HEIC/PDF, for the government-ID use case — narrowed further here
// since the ticket specifically scopes pet photos to JPEG/PNG/WebP.
const PET_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const addPhoto = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }
  if (!req.file) {
    return next(badRequest("A photo file is required in the 'file' field"));
  }
  if (!PET_PHOTO_MIME_TYPES.has(req.file.mimetype)) {
    return next(
      badRequest(
        `Unsupported file type '${req.file.mimetype}'. Allowed: JPEG, PNG, WebP`,
      ),
    );
  }

  // Multipart fields arrive as strings — only the exact string "true"
  // enables it, same convention as every other boolean query/form flag in
  // this codebase (e.g. adopterRiskFlag).
  const makePrimary = req.body?.primary === "true";

  try {
    const photos = await petsService.addPhoto(
      petID,
      { role: req.user.role, userID: req.user.userID },
      { file: { buffer: req.file.buffer, mimetype: req.file.mimetype }, makePrimary },
    );
    return successResponse(res, "Photo uploaded successfully", photos, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /pets/:id/photos/:photoId ———————————————
const deletePhoto = async (req, res, next) => {
  const petID = Number(req.params.id);
  const photoID = Number(req.params.photoId);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }
  if (!Number.isInteger(photoID) || photoID < 1) {
    return next(badRequest("photoId must be a positive integer"));
  }

  try {
    const photos = await petsService.deletePhoto(petID, photoID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Photo deleted successfully", photos);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createPet, updatePet, deletePet, addPhoto, deletePhoto };
