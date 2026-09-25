const teamService = require("../../services/staff/team.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("id must be a positive integer");
  }
  return n;
};

const VALID_SECTIONS = ["all", "pending"];
const VALID_DESIGNATION_FILTERS = ["Manager", "Senior", "Associate"];
const VALID_TARGET_STATUSES = ["Active", "Deactivated"];

// ——————————————— GET /staff/me/team ———————————————
const listTeam = async (req, res, next) => {
  const { section, staffDesignation, name, page: pageRaw, limit: limitRaw } = req.query;

  if (!VALID_SECTIONS.includes(section)) {
    return next(
      badRequest(`section is required and must be one of: ${VALID_SECTIONS.join(", ")}`),
    );
  }
  if (
    staffDesignation !== undefined &&
    !VALID_DESIGNATION_FILTERS.includes(staffDesignation)
  ) {
    return next(
      badRequest(
        `staffDesignation must be one of: ${VALID_DESIGNATION_FILTERS.join(", ")}`,
      ),
    );
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

  try {
    const result = await teamService.listTeam(req.user.userID, {
      section,
      staffDesignation,
      name: typeof name === "string" ? name.trim() : undefined,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Staff retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/me/team/:id ———————————————
// Designation is the only field a manager may change.
const updateTeamMember = async (req, res, next) => {
  let targetID;
  try {
    targetID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  const { staffDesignation } = req.body ?? {};
  if (staffDesignation === undefined) {
    return next(badRequest("staffDesignation is required"));
  }

  try {
    const member = await teamService.updateDesignation(
      req.user.userID,
      targetID,
      staffDesignation,
    );
    return successResponse(res, "Staff member updated successfully", member);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/me/team/:id/status ———————————————
const updateTeamMemberStatus = async (req, res, next) => {
  let targetID;
  try {
    targetID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  const { accountStatus } = req.body ?? {};
  if (!VALID_TARGET_STATUSES.includes(accountStatus)) {
    return next(
      badRequest(
        `accountStatus is required and must be one of: ${VALID_TARGET_STATUSES.join(", ")}`,
      ),
    );
  }

  try {
    const member = await teamService.updateStatus(req.user.userID, targetID, accountStatus);
    return successResponse(res, "Staff member status updated successfully", member);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listTeam, updateTeamMember, updateTeamMemberStatus };
