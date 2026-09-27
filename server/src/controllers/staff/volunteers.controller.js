const volunteersService = require("../../services/staff/volunteers.service");
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

const VALID_STATUS_FILTERS = ["Pending", "Active", "Banned", "Deactivated"];
const VALID_TARGET_STATUSES = ["Active", "Deactivated"];

// ——————————————— GET /volunteers ———————————————
const listVolunteers = async (req, res, next) => {
  const {
    accountStatus,
    name,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  if (accountStatus !== undefined && !VALID_STATUS_FILTERS.includes(accountStatus)) {
    return next(
      badRequest(`accountStatus must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
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
    const result = await volunteersService.listVolunteers(
      { role: req.user.role, userID: req.user.userID },
      { accountStatus, name, shelterID, page, limit },
    );
    return successListResponse(
      res,
      "Volunteers retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /volunteers/:id ———————————————
const getVolunteer = async (req, res, next) => {
  let userID;
  try {
    userID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const volunteer = await volunteersService.getVolunteerDetail(userID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Volunteer retrieved successfully", volunteer);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /volunteers/:id/status ———————————————
const updateVolunteerStatus = async (req, res, next) => {
  let userID;
  try {
    userID = parseId(req.params.id, "id");
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
    const volunteer = await volunteersService.updateVolunteerStatus(
      userID,
      { accountStatus },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, "Volunteer status updated successfully", volunteer);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listVolunteers, getVolunteer, updateVolunteerStatus };
