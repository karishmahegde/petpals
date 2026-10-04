const eventsService = require("../../services/volunteer/events.service");
const { successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// "true"/"false" or omitted — a closed value, so anything else is a 400.
const parseOptionalBoolean = (raw, field) => {
  if (raw === undefined) return undefined;
  if (raw !== "true" && raw !== "false") {
    throw badRequest(`${field} must be 'true' or 'false'`);
  }
  return raw === "true";
};

// Optional inclusive upper bound (ISO date-time) — the client works out
// "today" / "next 7 days" in the volunteer's own timezone.
const parseOptionalDate = (raw, field) => {
  if (raw === undefined) return undefined;
  const date = new Date(raw);
  if (typeof raw !== "string" || Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
};

// ——————————————— GET /volunteers/me/events ———————————————
const listMyShelterEvents = async (req, res, next) => {
  const { page: pageRaw, limit: limitRaw } = req.query;

  let upcoming;
  let assigned;
  let dateTo;
  try {
    upcoming = parseOptionalBoolean(req.query.upcoming, "upcoming");
    assigned = parseOptionalBoolean(req.query.assigned, "assigned");
    dateTo = parseOptionalDate(req.query.dateTo, "dateTo");
  } catch (err) {
    return next(err);
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
    const result = await eventsService.listMyShelterEvents(req.user.userID, {
      upcoming,
      assigned,
      dateTo,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Events retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyShelterEvents };
