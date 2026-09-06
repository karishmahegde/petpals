const adoptersService = require("../../services/adopter/adopters.service");
const adoptionApplicationsService = require("../../services/adopter/adoptionApplications.service");
const visitsService = require("../../services/adopter/visits.service");
const vaccinationsService = require("../../services/adopter/vaccinations.service");
const {
  assertValidCloseAccountMode,
  closeAccountMessage,
} = require("../../services/auth/auth.service");
const { successResponse, successListResponse } = require("../../utils/response");
const { normalizePhone } = require("../../utils/phone");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /adopters/me ———————————————
const getMe = async (req, res, next) => {
  try {
    const adopter = await adoptersService.getAdopterProfile(req.user.userID);
    return successResponse(res, "Adopter profile retrieved successfully", adopter);
  } catch (err) {
    return next(err);
  }
};

// Fields an adopter may change on their own profile. Anything outside this list
// is ignored; the admin-only fields below are actively rejected.
const UPDATABLE_FIELDS = [
  "avatarSeed",
  "adopterName",
  "adopterDOB",
  "adopterSex",
  "adopterPhone",
  "housingType",
  "ownsOrRents",
  "landlordContact",
  "householdSize",
  "numChildren",
  "employmentStatus",
  "activityLevel",
  "yardAvailable",
  "petExperience",
  "currentPets",
  "preferredBreedID",
  "preferredAgeRange",
  "preferredSize",
  "openToSpecialNeeds",
  "adopterType",
];

// Set by admins or the system only. A self-service update naming any of these is
// rejected outright rather than silently dropped, so escalation attempts surface.
const ADMIN_ONLY_FIELDS = [
  "adopterEmail",
  "adopterPassword",
  "adopterRiskFlag",
  "preQualifyFlag",
  "accountStatus",
];

const ENUM_VALUES = {
  housingType: ["Apartment", "House", "Other"],
  ownsOrRents: ["Owns", "Rents"],
  employmentStatus: ["Unemployed", "Student", "Self_employed", "Employed"],
  activityLevel: ["Sedentary", "Medium", "Active"],
  petExperience: ["No", "Little", "Some", "Very"],
  preferredAgeRange: ["Young", "Adult", "Old"],
  preferredSize: ["Small", "Medium", "Large"],
  adopterType: ["Fosterer", "Owner"],
};

const INTEGER_FIELDS = [
  "householdSize",
  "numChildren",
  "preferredBreedID",
  "currentPets",
];
const BOOLEAN_FIELDS = ["yardAvailable", "openToSpecialNeeds"];
// Max lengths from schema.prisma (VarChar/Char widths).
const STRING_MAX = {
  avatarSeed: 64,
  adopterName: 45,
  landlordContact: 20,
  adopterSex: 1,
};
// Columns that are NOT NULL in the schema — cannot be cleared via update.
const NON_NULLABLE = [
  "avatarSeed",
  "adopterName",
  "yardAvailable",
  "currentPets",
  "openToSpecialNeeds",
];

// ——————————————— PUT /adopters/me ———————————————
const updateMe = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const rejected = ADMIN_ONLY_FIELDS.filter((f) => f in body);
  if (rejected.length > 0) {
    return next(
      badRequest(`These fields cannot be updated here: ${rejected.join(", ")}`),
    );
  }

  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (!(field in body)) continue; // partial update — only touch provided fields
    const value = body[field];

    if (value === null) {
      if (NON_NULLABLE.includes(field)) {
        return next(badRequest(`${field} cannot be null`));
      }
      data[field] = null;
      continue;
    }

    if (field in ENUM_VALUES && !ENUM_VALUES[field].includes(value)) {
      return next(
        badRequest(`${field} must be one of: ${ENUM_VALUES[field].join(", ")}`),
      );
    }

    if (INTEGER_FIELDS.includes(field)) {
      if (!Number.isInteger(value) || value < 0) {
        return next(badRequest(`${field} must be a non-negative integer`));
      }
    }

    if (BOOLEAN_FIELDS.includes(field) && typeof value !== "boolean") {
      return next(badRequest(`${field} must be a boolean`));
    }

    if (field in STRING_MAX) {
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > STRING_MAX[field]
      ) {
        return next(
          badRequest(
            `${field} must be a non-empty string of at most ${STRING_MAX[field]} characters`,
          ),
        );
      }
    }

    if (field === "adopterDOB") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return next(badRequest("adopterDOB must be a valid date"));
      }
      data[field] = parsed;
      continue;
    }

    // Stores the parsed E.164 form — never what the client sent raw, even if
    // it looks correct.
    if (field === "adopterPhone") {
      try {
        data[field] = normalizePhone(value);
      } catch (err) {
        return next(err);
      }
      continue;
    }

    data[field] = value;
  }

  if (Object.keys(data).length === 0) {
    return next(badRequest("No updatable fields provided"));
  }

  try {
    const adopter = await adoptersService.updateAdopterProfile(
      req.user.userID,
      data,
    );
    return successResponse(res, "Adopter profile updated successfully", adopter);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /adopters/me/government-id ———————————————
const MAX_ID_FIELD_LEN = 45; // schema.prisma: idType / idNumber are VarChar(45)

const uploadGovernmentId = async (req, res, next) => {
  const idType =
    typeof req.body.idType === "string" ? req.body.idType.trim() : "";
  const idNumber =
    typeof req.body.idNumber === "string" ? req.body.idNumber.trim() : "";

  if (!idType || idType.length > MAX_ID_FIELD_LEN) {
    return next(
      badRequest(
        `idType is required and must be at most ${MAX_ID_FIELD_LEN} characters`,
      ),
    );
  }
  if (!idNumber || idNumber.length > MAX_ID_FIELD_LEN) {
    return next(
      badRequest(
        `idNumber is required and must be at most ${MAX_ID_FIELD_LEN} characters`,
      ),
    );
  }
  if (!req.file) {
    return next(badRequest("A document file is required in the 'file' field"));
  }

  try {
    const record = await adoptersService.createGovernmentId(req.user.userID, {
      idType,
      idNumber,
      file: {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      },
    });
    return successResponse(
      res,
      "Government ID submitted successfully",
      record,
      201,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/government-id ———————————————
const getGovernmentId = async (req, res, next) => {
  try {
    const record = await adoptersService.getGovernmentId(req.user.userID);
    return successResponse(
      res,
      "Government ID retrieved successfully",
      record,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/applications ———————————————
const VALID_APPLICATION_STATUSES = [
  "Pending",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

const getMyApplications = async (req, res, next) => {
  const { page: pageRaw, limit: limitRaw, status } = req.query;

  let page = 1;
  if (pageRaw !== undefined) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return next(badRequest("page must be an integer >= 1"));
    }
  }

  let limit = 20;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return next(badRequest("limit must be an integer between 1 and 100"));
    }
  }

  if (
    status !== undefined &&
    !VALID_APPLICATION_STATUSES.includes(status)
  ) {
    return next(
      badRequest(
        `status must be one of: ${VALID_APPLICATION_STATUSES.join(", ")}`,
      ),
    );
  }

  try {
    const result = await adoptionApplicationsService.listApplicationsByAdopter(
      req.user.userID,
      { status, page, limit },
    );
    return successListResponse(
      res,
      "Adoption applications retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/visits ———————————————
const getMyVisits = async (req, res, next) => {
  // Convenience flag — only the exact string "true" enables it; absent or any
  // other value returns all visits.
  const upcomingOnly = req.query.upcoming === "true";

  try {
    const visits = await visitsService.listVisitsByAdopter(req.user.userID, {
      upcomingOnly,
    });
    return successResponse(res, "Visits retrieved successfully", visits);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/adopted-pets ———————————————
const getMyAdoptedPets = async (req, res, next) => {
  try {
    const pets = await adoptionApplicationsService.listAdoptedPetsByAdopter(
      req.user.userID,
    );
    return successResponse(res, "Adopted pets retrieved successfully", pets);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/adopted-pets/:petId/vaccinations ———————————————
const getMyAdoptedPetVaccinations = async (req, res, next) => {
  const petID = Number(req.params.petId);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("petId must be a positive integer"));
  }

  try {
    const records = await vaccinationsService.listPetVaccinationsForAdopter(
      req.user.userID,
      petID,
    );
    return successResponse(
      res,
      "Vaccination history retrieved successfully",
      records,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /adopters/me ———————————————
const closeAccount = async (req, res, next) => {
  const { mode } = req.body ?? {};

  try {
    assertValidCloseAccountMode(mode);
    await adoptersService.closeAccount(req.user.userID, mode);
    return successResponse(res, closeAccountMessage(mode), null);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getMe,
  updateMe,
  uploadGovernmentId,
  getGovernmentId,
  getMyApplications,
  getMyVisits,
  getMyAdoptedPets,
  getMyAdoptedPetVaccinations,
  closeAccount,
};
