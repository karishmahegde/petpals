const adoptersService = require("../services/adopters.service");
const { successResponse } = require("../utils/response");

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
  "adopterName",
  "shelterID",
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
  "shelterID",
  "householdSize",
  "numChildren",
  "preferredBreedID",
  "currentPets",
];
const BOOLEAN_FIELDS = ["yardAvailable", "openToSpecialNeeds"];
// Max lengths from schema.prisma (VarChar/Char widths).
const STRING_MAX = {
  adopterName: 45,
  adopterPhone: 20,
  landlordContact: 20,
  adopterSex: 1,
};
// Columns that are NOT NULL in the schema — cannot be cleared via update.
const NON_NULLABLE = [
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

module.exports = { getMe, updateMe };
