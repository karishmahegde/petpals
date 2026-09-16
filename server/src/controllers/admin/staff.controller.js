const staffService = require("../../services/admin/staff.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const STAFF_DESIGNATION_VALUES = ["Manager", "Senior", "Associate"];
// Filtering (GET /staff?accountStatus=) recognizes all three states, including
// Pending — self-registered staff awaiting admin approval.
const STAFF_ACCOUNT_STATUS_FILTER_VALUES = ["Pending", "Active", "Deactivated"];
// PATCH /staff/:id/status only ever moves someone TO Active (approve) or
// Deactivated (decline/deactivate) — there's no real workflow for an admin to
// manually revert someone back to Pending, so it's deliberately not an
// accepted target here even though it's a valid stored value.
const STAFF_ACCOUNT_STATUS_TARGET_VALUES = ["Active", "Deactivated"];

// ——————————————— GET /staff ———————————————
const listStaff = async (req, res, next) => {
  const {
    shelterID: shelterIDRaw,
    staffDesignation,
    accountStatus,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

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

  let shelterID;
  if (shelterIDRaw !== undefined) {
    shelterID = Number(shelterIDRaw);
    if (!Number.isInteger(shelterID) || shelterID < 1) {
      return next(badRequest("shelterID must be a positive integer"));
    }
  }

  if (
    staffDesignation !== undefined &&
    !STAFF_DESIGNATION_VALUES.includes(staffDesignation)
  ) {
    return next(
      badRequest(
        `staffDesignation must be one of: ${STAFF_DESIGNATION_VALUES.join(", ")}`,
      ),
    );
  }

  if (
    accountStatus !== undefined &&
    !STAFF_ACCOUNT_STATUS_FILTER_VALUES.includes(accountStatus)
  ) {
    return next(
      badRequest(
        `accountStatus must be one of: ${STAFF_ACCOUNT_STATUS_FILTER_VALUES.join(", ")}`,
      ),
    );
  }

  try {
    const result = await staffService.listStaff({
      shelterID,
      staffDesignation,
      accountStatus,
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

// ——————————————— GET /staff/:id ———————————————
const getStaffDetail = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const staff = await staffService.getStaffDetail(userID);
    return successResponse(res, "Staff detail retrieved successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/:id ———————————————
// Only staffDesignation and shelterID are editable here — account activation
// is a separate endpoint (PATCH /staff/:id/status).
const updateStaff = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const data = {};

  if ("staffDesignation" in body) {
    if (!STAFF_DESIGNATION_VALUES.includes(body.staffDesignation)) {
      return next(
        badRequest(
          `staffDesignation must be one of: ${STAFF_DESIGNATION_VALUES.join(", ")}`,
        ),
      );
    }
    data.staffDesignation = body.staffDesignation;
  }

  if ("shelterID" in body) {
    const shelterID = Number(body.shelterID);
    if (!Number.isInteger(shelterID) || shelterID < 1) {
      return next(badRequest("shelterID must be a positive integer"));
    }
    data.shelterID = shelterID;
  }

  if (Object.keys(data).length === 0) {
    return next(badRequest("No updatable fields provided"));
  }

  try {
    const staff = await staffService.updateStaff(userID, data);
    return successResponse(res, "Staff updated successfully", staff);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/:id/status ———————————————
const updateStaffStatus = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const { accountStatus } = req.body ?? {};
  if (!STAFF_ACCOUNT_STATUS_TARGET_VALUES.includes(accountStatus)) {
    return next(
      badRequest(
        `accountStatus must be one of: ${STAFF_ACCOUNT_STATUS_TARGET_VALUES.join(", ")}`,
      ),
    );
  }

  try {
    const staff = await staffService.updateStaffStatus(userID, accountStatus);
    return successResponse(res, "Staff status updated successfully", staff);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listStaff,
  getStaffDetail,
  updateStaff,
  updateStaffStatus,
};
