const governmentIdsService = require("../../services/staff/governmentIds.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return n;
};

const VALID_SECTIONS = ["pending", "reviewed"];
const VALID_USER_TYPES = ["Adopter", "Volunteer", "Staff", "Veterinarian", "Admin"];
const VALID_STATUS_CHANGES = ["Verified", "Rejected"];

// ——————————————— GET /government-ids ———————————————
const listGovernmentIds = async (req, res, next) => {
  const {
    section,
    userType,
    name,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  if (!VALID_SECTIONS.includes(section)) {
    return next(badRequest(`section is required and must be one of: ${VALID_SECTIONS.join(", ")}`));
  }

  if (userType !== undefined && !VALID_USER_TYPES.includes(userType)) {
    return next(badRequest(`userType must be one of: ${VALID_USER_TYPES.join(", ")}`));
  }

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

  // Only meaningful for Admin — a Staff caller's shelter is always their
  // own, resolved server-side in the service, never from a query param.
  let shelterID;
  if (req.user.role === "Admin" && shelterIDRaw !== undefined) {
    shelterID = Number(shelterIDRaw);
    if (!Number.isInteger(shelterID) || shelterID < 1) {
      return next(badRequest("shelterID must be a positive integer"));
    }
  }

  try {
    const result = await governmentIdsService.listGovernmentIds(
      { role: req.user.role, userID: req.user.userID },
      { section, userType, name, shelterID, page, limit },
    );
    return successListResponse(
      res,
      "Government ID records retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /government-ids/:id ———————————————
const getGovernmentId = async (req, res, next) => {
  let governmentIDID;
  try {
    governmentIDID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const record = await governmentIdsService.getGovernmentIdDetail(governmentIDID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Government ID record retrieved successfully", record);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /government-ids/:id/status ———————————————
const updateGovernmentIdStatus = async (req, res, next) => {
  let governmentIDID;
  try {
    governmentIDID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  const { verificationStatus } = req.body ?? {};
  if (!VALID_STATUS_CHANGES.includes(verificationStatus)) {
    return next(
      badRequest(`verificationStatus is required and must be one of: ${VALID_STATUS_CHANGES.join(", ")}`),
    );
  }

  try {
    const record = await governmentIdsService.updateGovernmentIdStatus(
      governmentIDID,
      verificationStatus,
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(
      res,
      `Government ID ${verificationStatus.toLowerCase()} successfully`,
      record,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listGovernmentIds,
  getGovernmentId,
  updateGovernmentIdStatus,
};
