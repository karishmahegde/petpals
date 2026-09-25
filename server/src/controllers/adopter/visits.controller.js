const visitsService = require("../../services/adopter/visits.service");
const { successResponse, successListResponse } = require("../../utils/response");

const REMARKS_MAX = 300; // schema.prisma: remarks is VarChar(300)

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("id is required and must be a positive integer");
  }
  return n;
};

// ——————————————— POST /visits ———————————————
const createVisit = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { shelterID, petID, visitTime, remarks } = body;

  const shelterIDNum = Number(shelterID);
  if (!Number.isInteger(shelterIDNum) || shelterIDNum < 1) {
    return next(badRequest("shelterID is required and must be a positive integer"));
  }

  // petID is optional and explicitly nullable.
  let petIDNum = null;
  if (petID !== undefined && petID !== null) {
    petIDNum = Number(petID);
    if (!Number.isInteger(petIDNum) || petIDNum < 1) {
      return next(badRequest("petID must be a positive integer or null"));
    }
  }

  if (typeof visitTime !== "string" || visitTime.trim() === "") {
    return next(badRequest("visitTime is required (ISO datetime string)"));
  }
  const visitDate = new Date(visitTime);
  if (Number.isNaN(visitDate.getTime())) {
    return next(badRequest("visitTime must be a valid ISO datetime"));
  }
  if (visitDate.getTime() <= Date.now()) {
    return next(badRequest("visitTime must be in the future"));
  }

  if (remarks !== undefined && remarks !== null) {
    if (typeof remarks !== "string" || remarks.length > REMARKS_MAX) {
      return next(
        badRequest(`remarks must be a string of at most ${REMARKS_MAX} characters`),
      );
    }
  }

  try {
    const visit = await visitsService.createVisit({
      adopterID: req.user.userID,
      shelterID: shelterIDNum,
      petID: petIDNum,
      visitTime: visitDate,
      remarks: remarks ?? null,
    });
    return successResponse(res, "Visit scheduled successfully", visit, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /visits (staff queue) ———————————————
// Staff/Admin-scoped, paginated shelter-wide visit queue — distinct from
// GET /adopters/me/visits (one adopter's own visits). Same page/limit/
// ?upcoming= conventions as GET /adopters/me/visits and the staff-facing
// GET /adoption-applications queue, plus ?past= for the Past/Cancelled list.
const VALID_STATUS_FILTERS = ["Unconfirmed", "Confirmed", "Completed", "Cancelled"];

const listVisits = async (req, res, next) => {
  const {
    upcoming,
    past,
    status,
    name,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  if (upcoming === "true" && past === "true") {
    return next(badRequest("upcoming and past can't both be true"));
  }

  if (status !== undefined && !VALID_STATUS_FILTERS.includes(status)) {
    return next(
      badRequest(`status must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
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
    const result = await visitsService.listVisitsForStaff(
      { role: req.user.role, userID: req.user.userID },
      {
        upcomingOnly: upcoming === "true",
        pastOnly: past === "true",
        status,
        name,
        shelterID,
        page,
        limit,
      },
    );
    return successListResponse(
      res,
      "Visits retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /visits/:id ———————————————
const getVisitDetail = async (req, res, next) => {
  let visitID;
  try {
    visitID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  try {
    const visit = await visitsService.getVisitDetailForAdopter(
      visitID,
      req.user.userID,
    );
    return successResponse(res, "Visit detail retrieved successfully", visit);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /visits/:id ———————————————
// Adopter (Cancel) or Staff/Admin (Confirm/Complete) — which transitions are
// valid depends on the caller's role, not a shared enum. Matches
// adoptionApplications.controller.js's updateApplicationStatus design: an
// Adopter reaching for a Staff-only value gets the same generic 400 any
// other bogus value would, not a 403 that leaks that it's valid for someone
// else.
const VALID_ADOPTER_VISIT_STATUS_CHANGES = ["Cancelled"];
const VALID_STAFF_VISIT_STATUS_CHANGES = ["Confirmed", "Completed"];

const updateVisitStatus = async (req, res, next) => {
  let visitID;
  try {
    visitID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  const isStaffActor = req.user.role === "Staff" || req.user.role === "Admin";
  const allowedStatuses = isStaffActor
    ? VALID_STAFF_VISIT_STATUS_CHANGES
    : VALID_ADOPTER_VISIT_STATUS_CHANGES;

  const { visitStatus } = req.body ?? {};
  if (!allowedStatuses.includes(visitStatus)) {
    return next(
      badRequest(`visitStatus is required and must be one of: ${allowedStatuses.join(", ")}`),
    );
  }

  try {
    const visit = await visitsService.updateVisitStatus(
      visitID,
      { visitStatus },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, `Visit ${visitStatus.toLowerCase()} successfully`, visit);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createVisit, listVisits, getVisitDetail, updateVisitStatus };
