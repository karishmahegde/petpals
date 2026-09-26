const staffService = require("../../services/staff/staff.service");
const {
  assertValidCloseAccountMode,
  closeAccountMessage,
} = require("../../services/auth/auth.service");
const { successResponse } = require("../../utils/response");
const { normalizePhone } = require("../../utils/phone");
const { pickAddressUpdate } = require("../../utils/address");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /staff/me ———————————————
const getMyProfile = async (req, res, next) => {
  try {
    const staff = await staffService.getMyProfile(req.user.userID);
    return successResponse(res, "Profile retrieved successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// Fields a staff member may change on their own profile — no
// shelterID/staffDesignation like Admin manages via PATCH /staff/:id, and
// accountStatus is explicitly NOT here: that's Admin-approval-only (PATCH
// /staff/:id/status).
const SELF_UPDATABLE_FIELDS = [
  "avatarSeed",
  "staffName",
  "staffPhone",
  "staffDOB",
  "staffSex",
];
const SELF_REJECTED_FIELDS = ["shelterID", "staffDesignation", "accountStatus"];
// Nullable (unlike avatarSeed/staffName) — clearing one of these is a valid
// update, sent as `null` rather than omitted.
const SELF_NULLABLE_FIELDS = ["staffPhone", "staffDOB", "staffSex"];
const STAFF_SEX_VALUES = ["M", "F", "O"];

// ——————————————— PUT /staff/me ———————————————
const updateMyProfile = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const rejected = SELF_REJECTED_FIELDS.filter((f) => f in body);
  if (rejected.length > 0) {
    return next(
      badRequest(`These fields cannot be updated here: ${rejected.join(", ")}`),
    );
  }

  // Address fields (addressLine1/2, city, state, zip, country) — validated
  // by the shared helper, same rules on every role's profile.
  let data;
  try {
    data = pickAddressUpdate(body);
  } catch (err) {
    return next(err);
  }
  for (const field of SELF_UPDATABLE_FIELDS) {
    if (!(field in body)) continue; // partial update — only touch provided fields
    const value = body[field];

    if (value === null) {
      if (!SELF_NULLABLE_FIELDS.includes(field)) {
        return next(badRequest(`${field} cannot be empty`));
      }
      data[field] = null;
      continue;
    }

    if (typeof value !== "string" || !value.trim()) {
      return next(badRequest(`${field} cannot be empty`));
    }
    if (field === "staffName" && value.length > 45) {
      return next(badRequest("staffName must be 45 characters or fewer"));
    }
    if (field === "avatarSeed" && value.length > 64) {
      return next(badRequest("avatarSeed must be 64 characters or fewer"));
    }
    if (field === "staffSex" && !STAFF_SEX_VALUES.includes(value)) {
      return next(
        badRequest(`staffSex must be one of: ${STAFF_SEX_VALUES.join(", ")}`),
      );
    }
    if (field === "staffDOB") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return next(badRequest("staffDOB must be a valid date"));
      }
      data[field] = parsed;
      continue;
    }
    // Stores the parsed E.164 form — never what the client sent raw, even
    // if it looks correct.
    if (field === "staffPhone") {
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
    const staff = await staffService.updateMyProfile(req.user.userID, data);
    return successResponse(res, "Profile updated successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GOVERNMENT ID (GET/POST /staff/me/government-id) ———————
// Mirrors adopters.controller.js's uploadGovernmentId/getGovernmentId
// exactly — see staffService.createGovernmentId/getGovernmentId.
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
    const record = await staffService.createGovernmentId(req.user.userID, {
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

const getGovernmentId = async (req, res, next) => {
  try {
    const record = await staffService.getGovernmentId(req.user.userID);
    return successResponse(res, "Government ID retrieved successfully", record);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /staff/me ———————————————
// Deliberately no "last active manager of this shelter" guard here, same as
// Admin's closeMyAccount — this is self-service on your own account, and
// managerStaffID is cleared as part of the close regardless of mode (see
// staffService.closeMyAccount), so there's nothing left dangling to guard.
const closeMyAccount = async (req, res, next) => {
  const { mode } = req.body ?? {};

  try {
    assertValidCloseAccountMode(mode);
    await staffService.closeMyAccount(req.user.userID, mode);
    return successResponse(res, closeAccountMessage(mode), null);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadGovernmentId,
  getGovernmentId,
  closeMyAccount,
};
