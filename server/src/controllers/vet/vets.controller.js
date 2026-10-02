const vetsService = require("../../services/vet/vets.service");
const { successResponse } = require("../../utils/response");
const governmentIdService = require("../../services/governmentIds/selfGovernmentId.service");
const { normalizePhone } = require("../../utils/phone");
const { pickAddressUpdate } = require("../../utils/address");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /vets/me ———————————————
const getMyProfile = async (req, res, next) => {
  try {
    const vet = await vetsService.getMyProfile(req.user.userID);
    return successResponse(res, "Profile retrieved successfully", vet);
  } catch (err) {
    return next(err);
  }
};

// Fields a vet may change on their own profile. shelterID is picked at
// sign-up and accountStatus is the shelter manager's to set (PATCH
// /staff/me/vets/:id/status) — both rejected outright rather than silently
// dropped.
const SELF_UPDATABLE_FIELDS = [
  "avatarSeed",
  "vetName",
  "vetPhone",
  "vetDOB",
  "vetSex",
];
const SELF_REJECTED_FIELDS = ["shelterID", "accountStatus"];
// Nullable (unlike avatarSeed/vetName) — clearing one of these is a valid
// update, sent as `null` rather than omitted.
const SELF_NULLABLE_FIELDS = ["vetPhone", "vetDOB", "vetSex"];
const VET_SEX_VALUES = ["M", "F", "O"];

// ——————————————— PUT /vets/me ———————————————
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
    if (field === "vetName" && value.length > 45) {
      return next(badRequest("vetName must be 45 characters or fewer"));
    }
    if (field === "avatarSeed" && value.length > 64) {
      return next(badRequest("avatarSeed must be 64 characters or fewer"));
    }
    if (field === "vetSex" && !VET_SEX_VALUES.includes(value)) {
      return next(
        badRequest(`vetSex must be one of: ${VET_SEX_VALUES.join(", ")}`),
      );
    }
    if (field === "vetDOB") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return next(badRequest("vetDOB must be a valid date"));
      }
      data[field] = parsed;
      continue;
    }
    // Stores the parsed E.164 form — never what the client sent raw, even
    // if it looks correct.
    if (field === "vetPhone") {
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
    const vet = await vetsService.updateMyProfile(req.user.userID, data);
    return successResponse(res, "Profile updated successfully", vet);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /vets/me/onboarding-step ———————————————
const advanceOnboardingStep = async (req, res, next) => {
  const step = Number(req.body?.step);
  if (!Number.isInteger(step) || step < 2 || step > 5) {
    return next(badRequest("step must be an integer between 2 and 5"));
  }

  try {
    const vet = await vetsService.advanceOnboardingStep(req.user.userID, step);
    return successResponse(res, "Onboarding step updated successfully", vet);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /vets/me/onboarding-complete ———————————————
const completeOnboarding = async (req, res, next) => {
  try {
    const vet = await vetsService.completeOnboarding(req.user.userID);
    return successResponse(res, "Onboarding completed successfully", vet);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GOVERNMENT ID (GET/POST /vets/me/government-id) ———————————————
// Shared with every role's /me/government-id — see
// services/governmentIds/selfGovernmentId.service.js.
const uploadGovernmentId = async (req, res, next) => {
  try {
    const upload = governmentIdService.parseUpload(req);
    const record = await governmentIdService.createGovernmentId(
      "Veterinarian",
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
      "Veterinarian",
      req.user.userID,
    );
    return successResponse(res, "Government ID retrieved successfully", record);
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
};
