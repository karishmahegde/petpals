const staffService = require("../../services/staff/staff.service");
const {
  assertValidCloseAccountMode,
  closeAccountMessage,
} = require("../../services/auth/auth.service");
const { successResponse } = require("../../utils/response");
const governmentIdService = require("../../services/governmentIds/selfGovernmentId.service");
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

// ——————————————— PATCH /staff/me/onboarding-step ———————————————
const advanceOnboardingStep = async (req, res, next) => {
  const step = Number(req.body?.step);
  if (!Number.isInteger(step) || step < 2 || step > 5) {
    return next(badRequest("step must be an integer between 2 and 5"));
  }

  try {
    const staff = await staffService.advanceOnboardingStep(req.user.userID, step);
    return successResponse(res, "Onboarding step updated successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/me/onboarding-complete ———————————————
const completeOnboarding = async (req, res, next) => {
  try {
    const staff = await staffService.completeOnboarding(req.user.userID);
    return successResponse(res, "Onboarding completed successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GOVERNMENT ID (GET/POST /staff/me/government-id) ———————————————
// Shared with every role's /me/government-id — see
// services/governmentIds/selfGovernmentId.service.js.
const uploadGovernmentId = async (req, res, next) => {
  try {
    const upload = governmentIdService.parseUpload(req);
    const record = await governmentIdService.createGovernmentId(
      "Staff",
      req.user.userID,
      upload,
    );
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
    const record = await governmentIdService.getGovernmentId(
      "Staff",
      req.user.userID,
    );
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
  advanceOnboardingStep,
  completeOnboarding,
  uploadGovernmentId,
  getGovernmentId,
  closeMyAccount,
};
