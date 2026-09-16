const sheltersService = require("../../services/admin/shelters.service");
const { successResponse } = require("../../utils/response");
const { normalizePhone } = require("../../utils/phone");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// Fields accepted on both POST and PUT. Max lengths from schema.prisma
// (VarChar widths).
const STRING_MAX = {
  shelterName: 45,
  shelterAddress: 45,
  shelterPhone: 20,
  shelterEmail: 45,
};
const CREATABLE_FIELDS = [
  "shelterName",
  "shelterAddress",
  "shelterPhone",
  "shelterEmail",
  "shelterZIP",
  "shelterSize",
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates and normalizes one field's raw value. Shared by create (every
// field required) and update (only present fields are checked) so the two
// routes can't drift on what counts as valid.
const validateField = (field, rawValue) => {
  switch (field) {
    case "shelterName":
    case "shelterAddress":
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

    case "shelterPhone":
      // Throws its own VALIDATION_ERROR (422) if it doesn't parse — same
      // helper every other phone-carrying table uses.
      return normalizePhone(rawValue);

    case "shelterEmail":
      if (
        typeof rawValue !== "string" ||
        !EMAIL_RE.test(rawValue) ||
        rawValue.length > STRING_MAX.shelterEmail
      ) {
        throw badRequest(
          `shelterEmail must be a valid email address of at most ${STRING_MAX.shelterEmail} characters`,
        );
      }
      return rawValue.trim();

    case "shelterZIP":
      if (!Number.isInteger(rawValue) || rawValue < 1) {
        throw badRequest("shelterZIP must be a positive integer");
      }
      return rawValue;

    case "shelterSize":
      if (!Number.isInteger(rawValue) || rawValue < 1) {
        throw badRequest("shelterSize must be a positive integer");
      }
      return rawValue;

    default:
      return rawValue;
  }
};

// ——————————————— POST /shelters ———————————————
const createShelter = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const missing = CREATABLE_FIELDS.filter((field) => !(field in body));
  if (missing.length > 0) {
    return next(
      badRequest(`Missing required field(s): ${missing.join(", ")}`),
    );
  }

  const data = {};
  try {
    for (const field of CREATABLE_FIELDS) {
      data[field] = validateField(field, body[field]);
    }
  } catch (err) {
    return next(err);
  }

  try {
    const shelter = await sheltersService.createShelter(data);
    return successResponse(res, "Shelter created successfully", shelter, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /shelters/:id ———————————————
const updateShelter = async (req, res, next) => {
  const shelterID = Number(req.params.id);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const data = {};
  try {
    for (const field of CREATABLE_FIELDS) {
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
    const shelter = await sheltersService.updateShelter(shelterID, data);
    return successResponse(res, "Shelter updated successfully", shelter);
  } catch (err) {
    return next(err);
  }
};

const SHELTER_STATUS_VALUES = ["Open", "Full", "Closed"];

// ——————————————— PATCH /shelters/:id/status ———————————————
const updateShelterStatus = async (req, res, next) => {
  const shelterID = Number(req.params.id);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const { shelterStatus } = req.body ?? {};
  if (!SHELTER_STATUS_VALUES.includes(shelterStatus)) {
    return next(
      badRequest(
        `shelterStatus must be one of: ${SHELTER_STATUS_VALUES.join(", ")}`,
      ),
    );
  }

  try {
    const shelter = await sheltersService.updateShelterStatus(
      shelterID,
      shelterStatus,
    );
    return successResponse(res, "Shelter status updated successfully", shelter);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /shelters/:id/manager ———————————————
const updateShelterManager = async (req, res, next) => {
  const shelterID = Number(req.params.id);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const managerStaffID = Number(req.body?.managerStaffID);
  if (!Number.isInteger(managerStaffID) || managerStaffID < 1) {
    return next(badRequest("managerStaffID must be a positive integer"));
  }

  try {
    const shelter = await sheltersService.updateShelterManager(
      shelterID,
      managerStaffID,
    );
    return successResponse(res, "Shelter manager updated successfully", shelter);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManager,
};
