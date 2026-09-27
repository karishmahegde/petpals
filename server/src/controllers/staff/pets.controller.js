const petsService = require("../../services/staff/pets.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// req.query gives a single string for one occurrence of a param, or an array
// when the param is repeated (?species=1&species=2) — normalize to array either way.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const PET_SEX_VALUES = ["M", "F"]; // live DB column is character(1) — see schema.prisma's petSex note
const PET_SIZE_VALUES = ["Small", "Medium", "Large"];
const INTAKE_TYPE_VALUES = ["stray", "surrendered", "transferred"];
const VALID_SORTS = ["newest"];
const ADOPTION_STATUS_VALUES = [
  "incoming",
  "available",
  "adopted",
  "fostered",
  "transferred",
  "deceased",
];

// See staff/pets.service.js's LOCKED_STATUS_MESSAGE.
const SYSTEM_ONLY_STATUSES = ["transferred", "adopted"];

const STRING_MAX = {
  petName: 45,
  petColor: 45,
  petBGroup: 5,
  microchipID: 45,
  petDesc: 500,
};

// PUT /pets/:id now optionally carries a photo alongside the field changes
// (a single combined multipart request from the edit form's Save — see
// logic/api/staffPetsApi.ts), so its body no longer arrives as parsed JSON
// with real types: multer puts every non-file field on req.body as a
// string. POST /pets stays plain JSON. validateField has to accept either
// shape without weakening what it rejects, so numeric/boolean fields
// coerce a STRING input before checking it, leaving a same-typed JSON value
// (or any other wrong type) to fail exactly as before.
const coerceIfString = (rawValue, coerce) =>
  typeof rawValue === "string" ? coerce(rawValue) : rawValue;

const PET_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

// Optional on create — present-if-sent, validated the same as everywhere
// else, but never required. petBGroup falls back to "N/A" when omitted
// (see below); intakeType is nullable in the schema so it just stays null;
// adoptionStatus falls back to "incoming" in the service (a new arrival
// stays out of the public catalog until staff mark it available).
const OPTIONAL_CREATE_FIELDS = ["petBGroup", "intakeType", "adoptionStatus"];

// PUT accepts a partial update of everything creatable, minus shelterID
// (reassigning a pet to another shelter is a transfer, not a profile edit —
// out of scope here), plus the ticket's explicit PUT-only additions.
// petBGroup is deliberately NOT in CREATE_REQUIRED_FIELDS even though it's
// also NOT NULL with no default — unlike petName/petWeight/petHeight, a
// blood group is routinely unknown at shelter intake, so it defaults to
// "N/A" (matching the existing seed-data convention) when omitted on
// create, and can be filled in later via PUT. adoptionStatus is optional
// on create (defaults to "incoming") and editable via PUT — lets staff
// manually correct/override it (e.g. mark deceased or transferred)
// alongside the automatic available → adopted transition an accepted
// adoption application already drives. compatibleWithChildren/
// compatibleWithPets/specialNeeds and featuredFlag are also PUT-only —
// profile-facing judgment calls a shelter typically only makes once it's
// had a chance to observe the pet, matching petDesc's own edit-only
// treatment in the form.
const UPDATABLE_FIELDS = [
  "breedID",
  "petName",
  "petDOB",
  "petSex",
  "petColor",
  "petSize",
  "intakeDate",
  "intakeType",
  "petWeight",
  "petHeight",
  "petBGroup",
  "petDesc",
  "microchipID",
  "featuredFlag",
  "adoptionStatus",
  "compatibleWithChildren",
  "compatibleWithPets",
  "specialNeeds",
];

// Shared by create (every required field present) and update (only present
// fields are checked) so the two routes can't drift on what counts as valid.
const validateField = (field, rawValue) => {
  switch (field) {
    case "breedID": {
      const breedID = coerceIfString(rawValue, Number);
      if (!Number.isInteger(breedID) || breedID < 1) {
        throw badRequest("breedID must be a positive integer");
      }
      return breedID;
    }

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
      // null clears it (JSON callers); multipart has no way to send a real
      // null, so an empty string means the same thing there — the edit
      // form already collapses a blanked-out textarea to "" either way.
      if (rawValue === null || rawValue === "") return null;
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

    case "intakeType":
      if (rawValue === null || rawValue === "") return null; // nullable — how a pet arrived isn't always known
      if (!INTAKE_TYPE_VALUES.includes(rawValue)) {
        throw badRequest(`intakeType must be one of: ${INTAKE_TYPE_VALUES.join(", ")}`);
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
    case "petHeight": {
      const num = coerceIfString(rawValue, Number);
      if (typeof num !== "number" || !Number.isFinite(num) || num <= 0) {
        throw badRequest(`${field} must be a positive number`);
      }
      return num;
    }

    case "featuredFlag":
    case "compatibleWithChildren":
    case "compatibleWithPets":
    case "specialNeeds": {
      const flag = coerceIfString(rawValue, (v) => v === "true");
      if (typeof flag !== "boolean") {
        throw badRequest(`${field} must be a boolean`);
      }
      // A multipart "false" string must actually mean false, not just
      // "not the string 'true'" swallowing a typo — reject anything that
      // isn't literally "true"/"false" rather than silently coercing it.
      if (typeof rawValue === "string" && rawValue !== "true" && rawValue !== "false") {
        throw badRequest(`${field} must be "true" or "false"`);
      }
      return flag;
    }

    case "adoptionStatus":
      if (!ADOPTION_STATUS_VALUES.includes(rawValue)) {
        throw badRequest(
          `adoptionStatus must be one of: ${ADOPTION_STATUS_VALUES.join(", ")}`,
        );
      }
      // 'transferred' and 'adopted' are set (and undone) only by the
      // transfer and adoption-application workflows — set by hand, the pet
      // would be locked read-only with nothing to ever release it.
      if (SYSTEM_ONLY_STATUSES.includes(rawValue)) {
        throw badRequest(
          `adoptionStatus '${rawValue}' is set only by the ${rawValue === "adopted" ? "adoption application" : "transfer"} workflow`,
        );
      }
      return rawValue;

    default:
      return rawValue;
  }
};

// ——————————————— GET /staff/me/pets ———————————————
// species/breed/size/minAge/maxAge use the exact same query param names and
// repeatable-value convention as public GET /pets (routes/public/pets.routes.js)
// so the frontend's staff filter bar can reuse that same request-building logic.
const listMyShelterPets = async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const adoptionStatus =
    typeof req.query.adoptionStatus === "string"
      ? req.query.adoptionStatus
      : undefined;

  if (adoptionStatus && !ADOPTION_STATUS_VALUES.includes(adoptionStatus)) {
    return next(
      badRequest(
        `adoptionStatus must be one of: ${ADOPTION_STATUS_VALUES.join(", ")}`,
      ),
    );
  }

  // sort is closed/fixed-value, so an unrecognized value is a 400 — same
  // convention as public GET /pets's own sort param.
  const { sort } = req.query;
  if (sort !== undefined && !VALID_SORTS.includes(sort)) {
    return next(badRequest(`sort must be one of: ${VALID_SORTS.join(", ")}`));
  }

  // species is numeric (speciesID) — same conversion/validation as public
  // GET /pets's own species param (public/pets.controller.js). Without this,
  // Prisma rejects the string query-param values matchFilter passes through.
  const speciesValues = toArray(req.query.species).map((raw) => Number(raw));
  if (speciesValues.some((s) => !Number.isInteger(s))) {
    return next(badRequest("species must be an array of integers (speciesID)"));
  }

  try {
    const { data, pagination } = await petsService.listMyShelterPets(
      req.user.userID,
      {
        page,
        limit,
        adoptionStatus,
        species: speciesValues,
        breed: req.query.breed,
        size: req.query.size,
        minAge: req.query.minAge,
        maxAge: req.query.maxAge,
        sort,
      },
    );
    return successListResponse(
      res,
      "Pets retrieved successfully",
      data,
      pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /staff/me/pets/:id ———————————————
// Richer than public GET /pets/:id — see petsService.getShelterPetDetail's
// design note. Powers the Pets tab's read-only detail view.
const getShelterPetDetail = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const pet = await petsService.getShelterPetDetail(petID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Pet retrieved successfully", pet);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /staff/me/pets/:id/health-passport ———————————————
const getHealthPassport = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const passport = await petsService.getHealthPassport(petID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Health passport retrieved successfully", passport);
  } catch (err) {
    return next(err);
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
  // OPTIONAL_CREATE_FIELDS (petBGroup, intakeType, adoptionStatus) are
  // validated only if the caller actually sent them — petBGroup then falls
  // back to "N/A" below; intakeType just stays absent (nullable in the
  // schema); adoptionStatus falls back to "incoming" in the service.
  const fieldsToValidate = [
    ...CREATE_REQUIRED_FIELDS,
    ...OPTIONAL_CREATE_FIELDS.filter((field) => body[field] !== undefined),
  ];
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
// Multipart, not JSON — the edit form's Save now sends its field changes
// and an optional new photo in ONE request (see logic/api/staffPetsApi.ts
// and the singleFile("file") middleware on this route), replacing what used
// to be two independent actions (Save the form, separately click Upload).
// The photo is optional on every save; req.file is simply absent when the
// staff member didn't touch it.
const updatePet = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  if (req.file && !PET_PHOTO_MIME_TYPES.has(req.file.mimetype)) {
    return next(
      badRequest(
        `Unsupported file type '${req.file.mimetype}'. Allowed: JPEG, PNG, WebP`,
      ),
    );
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

  if (Object.keys(data).length === 0 && !req.file) {
    return next(badRequest("No updatable fields provided"));
  }

  const photoFile = req.file
    ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
    : undefined;

  try {
    const pet = await petsService.updatePet(
      petID,
      data,
      {
        role: req.user.role,
        userID: req.user.userID,
      },
      photoFile,
    );
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

// ——————————————— GET /pets/:id/photos ———————————————
const getPhotos = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const photos = await petsService.getPhotos(petID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Photos retrieved successfully", photos);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /pets/:id/photos ———————————————
// The shared upload middleware (middleware/upload.js's singleFile) also
// allows HEIC/PDF, for the government-ID use case — narrowed further here
// (and on PUT /pets/:id above) since pet photos are scoped to JPEG/PNG/WebP.
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

  try {
    const photos = await petsService.addPhoto(
      petID,
      { role: req.user.role, userID: req.user.userID },
      { file: { buffer: req.file.buffer, mimetype: req.file.mimetype } },
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

module.exports = {
  listMyShelterPets,
  getShelterPetDetail,
  getHealthPassport,
  createPet,
  updatePet,
  deletePet,
  getPhotos,
  addPhoto,
  deletePhoto,
};
