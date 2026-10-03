const donorsService = require("../../services/donor/donors.service");
const { successResponse } = require("../../utils/response");
const {
  assertValidCloseAccountMode,
  closeAccountMessage,
} = require("../../services/auth/auth.service");
const { normalizePhone } = require("../../utils/phone");
const { pickAddressUpdate } = require("../../utils/address");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /donors/me ———————————————
const getMyProfile = async (req, res, next) => {
  try {
    const donor = await donorsService.getMyProfile(req.user.userID);
    return successResponse(res, "Profile retrieved successfully", donor);
  } catch (err) {
    return next(err);
  }
};

// Fields a donor may change on their own profile. accountStatus is an
// admin's to set and stripeCustomerID is Stripe's — both rejected outright
// rather than silently dropped.
const SELF_UPDATABLE_FIELDS = [
  "avatarSeed",
  "donorName",
  "donorPhone",
  "donorDOB",
  "donorSex",
];
const SELF_REJECTED_FIELDS = ["accountStatus", "stripeCustomerID"];
// Nullable (unlike avatarSeed/donorName) — clearing one of these is a
// valid update, sent as `null` rather than omitted.
const SELF_NULLABLE_FIELDS = ["donorPhone", "donorDOB", "donorSex"];
const DONOR_SEX_VALUES = ["M", "F", "O"];

// ——————————————— PUT /donors/me ———————————————
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
    if (field === "donorName" && value.length > 45) {
      return next(badRequest("donorName must be 45 characters or fewer"));
    }
    if (field === "avatarSeed" && value.length > 64) {
      return next(badRequest("avatarSeed must be 64 characters or fewer"));
    }
    if (field === "donorSex" && !DONOR_SEX_VALUES.includes(value)) {
      return next(
        badRequest(
          `donorSex must be one of: ${DONOR_SEX_VALUES.join(", ")}`,
        ),
      );
    }
    if (field === "donorDOB") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return next(badRequest("donorDOB must be a valid date"));
      }
      data[field] = parsed;
      continue;
    }
    // Stores the parsed E.164 form — never what the client sent raw, even
    // if it looks correct.
    if (field === "donorPhone") {
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
    const donor = await donorsService.updateMyProfile(
      req.user.userID,
      data,
    );
    return successResponse(res, "Profile updated successfully", donor);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /donors/me/onboarding-step ———————————————
const advanceOnboardingStep = async (req, res, next) => {
  const step = Number(req.body?.step);
  // Donor wizard: 2 Personal, 3 Address, 4 Review.
  if (!Number.isInteger(step) || step < 2 || step > 4) {
    return next(badRequest("step must be an integer between 2 and 4"));
  }

  try {
    const donor = await donorsService.advanceOnboardingStep(
      req.user.userID,
      step,
    );
    return successResponse(res, "Onboarding step updated successfully", donor);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /donors/me/onboarding-complete ———————————————
const completeOnboarding = async (req, res, next) => {
  try {
    const donor = await donorsService.completeOnboarding(req.user.userID);
    return successResponse(res, "Onboarding completed successfully", donor);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /donors/me ———————————————
// Same mode validation and response message as every role's close-account
// flow (auth.service.js) — 422 for a missing/invalid mode.
const closeMyAccount = async (req, res, next) => {
  const { mode } = req.body ?? {};

  try {
    assertValidCloseAccountMode(mode);
    await donorsService.closeMyAccount(req.user.userID, mode);
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
  closeMyAccount,
};
