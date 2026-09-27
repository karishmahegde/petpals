const eventsService = require("../../services/public/events.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /events ———————————————
const getEvents = async (req, res, next) => {
  const {
    page: pageRaw,
    limit: limitRaw,
    shelterID: shelterIDRaw,
    upcoming,
    past,
    name,
  } = req.query;

  if (upcoming === "true" && past === "true") {
    return next(badRequest("upcoming and past can't both be true"));
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

  // Repeatable, and not strictly validated — same convention as GET /pets'
  // shelterID: a non-numeric value is coerced to an ID that can never match,
  // so the query naturally returns 0 results instead of erroring.
  const shelterIDs =
    shelterIDRaw === undefined
      ? []
      : [].concat(shelterIDRaw).map((raw) => {
          const parsed = Number(raw);
          return Number.isInteger(parsed) ? parsed : -1;
        });

  try {
    const result = await eventsService.getEvents(
      {
        shelterIDs,
        upcomingOnly: upcoming === "true",
        pastOnly: past === "true",
        name: typeof name === "string" ? name.trim() : undefined,
      },
      { page, limit },
    );
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

// ——————————————— GET /events/:id ———————————————
const getEventDetails = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const event = await eventsService.getEventDetails(id);
    return successResponse(res, "Event retrieved successfully", event);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getEvents, getEventDetails };
