const appointmentsService = require("../../services/volunteer/appointments.service");
const { successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /volunteers/me/appointments ———————————————
// Same upcoming/page/limit rules as GET /vets/me/appointments — upcoming is
// a closed true/false value, so anything else is a 400.
const listMyAppointments = async (req, res, next) => {
  const { upcoming: upcomingRaw, page: pageRaw, limit: limitRaw } = req.query;

  if (upcomingRaw !== undefined && upcomingRaw !== "true" && upcomingRaw !== "false") {
    return next(badRequest("upcoming must be 'true' or 'false'"));
  }
  const upcoming = upcomingRaw === "true";

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
    const result = await appointmentsService.listMyAppointments(req.user.userID, {
      upcoming,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Appointments retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyAppointments };
