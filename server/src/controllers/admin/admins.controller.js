const adminsService = require("../../services/admin/admins.service");
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

// Filtering (GET /admins?accountStatus=) recognizes all three states,
// including Pending — self-registered admins awaiting approval by an
// existing admin.
const ADMIN_ACCOUNT_STATUS_FILTER_VALUES = ["Pending", "Active", "Deactivated"];
// PATCH /admins/:id/status only ever moves someone TO Active (approve) or
// Deactivated (decline/deactivate) — same convention as Staff.
const ADMIN_ACCOUNT_STATUS_TARGET_VALUES = ["Active", "Deactivated"];

// ——————————————— GET /admins/me ———————————————
const getMyProfile = async (req, res, next) => {
  try {
    const admin = await adminsService.getAdminDetail(req.user.userID);
    return successResponse(res, "Profile retrieved successfully", admin);
  } catch (err) {
    return next(err);
  }
};

// Fields an admin may change on their own profile — no designation/shelter
// like Staff. accountStatus is explicitly NOT here: that's admin-approval-
// only (PATCH /admins/:id/status).
const SELF_UPDATABLE_FIELDS = [
  "avatarSeed",
  "adminName",
  "adminPhone",
  "adminAddress",
  "adminDOB",
  "adminSex",
];
const SELF_REJECTED_FIELDS = ["accountStatus"];
// Nullable (unlike avatarSeed/adminName) — clearing one of these is a valid
// update, sent as `null` rather than omitted.
const SELF_NULLABLE_FIELDS = ["adminPhone", "adminAddress", "adminDOB", "adminSex"];
const ADMIN_SEX_VALUES = ["M", "F", "O"];

// ——————————————— PUT /admins/me ———————————————
const updateMyProfile = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const rejected = SELF_REJECTED_FIELDS.filter((f) => f in body);
  if (rejected.length > 0) {
    return next(
      badRequest(`These fields cannot be updated here: ${rejected.join(", ")}`),
    );
  }

  const data = {};
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
    if (field === "adminName" && value.length > 45) {
      return next(badRequest("adminName must be 45 characters or fewer"));
    }
    if (field === "avatarSeed" && value.length > 64) {
      return next(badRequest("avatarSeed must be 64 characters or fewer"));
    }
    if (field === "adminAddress" && value.length > 45) {
      return next(badRequest("adminAddress must be 45 characters or fewer"));
    }
    if (field === "adminSex" && !ADMIN_SEX_VALUES.includes(value)) {
      return next(
        badRequest(`adminSex must be one of: ${ADMIN_SEX_VALUES.join(", ")}`),
      );
    }
    if (field === "adminDOB") {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return next(badRequest("adminDOB must be a valid date"));
      }
      data[field] = parsed;
      continue;
    }
    // Stores the parsed E.164 form — never what the client sent raw, even
    // if it looks correct.
    if (field === "adminPhone") {
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
    const admin = await adminsService.updateMyProfile(req.user.userID, data);
    return successResponse(res, "Profile updated successfully", admin);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /admins/me ———————————————
// Deliberately no "last active Admin" guard here, unlike updateAdminStatus
// above — this is self-service on your own account (same as every other
// role's close-account flow), not one Admin acting on another's.
const closeMyAccount = async (req, res, next) => {
  const { mode } = req.body ?? {};

  try {
    assertValidCloseAccountMode(mode);
    await adminsService.closeMyAccount(req.user.userID, mode);
    return successResponse(res, closeAccountMessage(mode), null);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GOVERNMENT ID (GET/POST /admins/me/government-id) ———————
// Mirrors adopters.controller.js's uploadGovernmentId/getGovernmentId
// exactly — see adminsService.createGovernmentId/getGovernmentId.
const MAX_ID_FIELD_LEN = 45;

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
    const record = await adminsService.createGovernmentId(req.user.userID, {
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
    const record = await adminsService.getGovernmentId(req.user.userID);
    return successResponse(res, "Government ID retrieved successfully", record);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /admins ———————————————
const listAdmins = async (req, res, next) => {
  const { accountStatus, page: pageRaw, limit: limitRaw } = req.query;

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
    accountStatus !== undefined &&
    !ADMIN_ACCOUNT_STATUS_FILTER_VALUES.includes(accountStatus)
  ) {
    return next(
      badRequest(
        `accountStatus must be one of: ${ADMIN_ACCOUNT_STATUS_FILTER_VALUES.join(", ")}`,
      ),
    );
  }

  try {
    const result = await adminsService.listAdmins({ accountStatus, page, limit });
    return successListResponse(
      res,
      "Admins retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /admins/:id ———————————————
const getAdminDetail = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const admin = await adminsService.getAdminDetail(userID);
    return successResponse(res, "Admin detail retrieved successfully", admin);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /admins/:id/status ———————————————
const updateAdminStatus = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const { accountStatus } = req.body ?? {};
  if (!ADMIN_ACCOUNT_STATUS_TARGET_VALUES.includes(accountStatus)) {
    return next(
      badRequest(
        `accountStatus must be one of: ${ADMIN_ACCOUNT_STATUS_TARGET_VALUES.join(", ")}`,
      ),
    );
  }

  // Unlike Staff (a different table than the acting Admin), self-targeting
  // is actually reachable here — an Admin viewing their own row. Blocking
  // self-deactivation avoids the only-Active-Admin-in-the-org locking
  // themselves out with no one left to reverse it.
  if (userID === req.user.userID && accountStatus === "Deactivated") {
    return next(badRequest("You cannot deactivate your own account"));
  }

  try {
    const admin = await adminsService.updateAdminStatus(
      userID,
      accountStatus,
      req.user.userID,
    );
    return successResponse(res, "Admin status updated successfully", admin);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listAdmins,
  getAdminDetail,
  updateAdminStatus,
  getMyProfile,
  updateMyProfile,
  closeMyAccount,
  uploadGovernmentId,
  getGovernmentId,
};
