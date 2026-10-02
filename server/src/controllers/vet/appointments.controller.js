const appointmentsService = require("../../services/vet/appointments.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /vets/me/appointments ———————————————
// Same query params as the Staff GET /appointments (upcoming, petName, page,
// limit) — upcoming is a closed true/false value, so anything else is a 400.
const listMyAppointments = async (req, res, next) => {
  const {
    upcoming: upcomingRaw,
    petName,
    dateFrom: dateFromRaw,
    dateTo: dateToRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

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

  // Optional inclusive date range (ISO date-times).
  const parseDate = (raw, field) => {
    if (raw === undefined) return undefined;
    const date = new Date(raw);
    if (typeof raw !== "string" || Number.isNaN(date.getTime())) {
      throw badRequest(`${field} must be a valid date`);
    }
    return date;
  };
  let dateFrom;
  let dateTo;
  try {
    dateFrom = parseDate(dateFromRaw, "dateFrom");
    dateTo = parseDate(dateToRaw, "dateTo");
  } catch (err) {
    return next(err);
  }

  try {
    const result = await appointmentsService.listMyAppointments(req.user.userID, {
      upcoming,
      petName: typeof petName === "string" ? petName.trim() : undefined,
      dateFrom,
      dateTo,
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

// ——————————————— GET /vets/me/appointments/:id ———————————————
const getMyAppointment = async (req, res, next) => {
  const appointmentID = Number(req.params.id);
  if (!Number.isInteger(appointmentID) || appointmentID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const appointment = await appointmentsService.getMyAppointment(
      req.user.userID,
      appointmentID,
    );
    return successResponse(res, "Appointment retrieved successfully", appointment);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /appointments/:id/status ———————————————
// Body key is the column name, like tasks/transfers/government-ids. Completed
// is the only status a vet can set — cancelling stays the Staff-only PATCH
// /appointments/:id/cancel.
const MAX_NOTES_LEN = 500; // schema.prisma: HealthRecord.recordDesc is VarChar(500)

const completeAppointment = async (req, res, next) => {
  const appointmentID = Number(req.params.id);
  if (!Number.isInteger(appointmentID) || appointmentID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.appointmentStatus !== "Completed") {
    return next(badRequest("appointmentStatus is required and must be 'Completed'"));
  }

  let notes;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string" || body.notes.trim().length > MAX_NOTES_LEN) {
      return next(
        badRequest(`notes must be a string of at most ${MAX_NOTES_LEN} characters`),
      );
    }
    // Blank notes just mean "no health record".
    notes = body.notes.trim() || undefined;
  }

  try {
    const appointment = await appointmentsService.completeAppointment(
      req.user.userID,
      appointmentID,
      { notes },
    );
    return successResponse(res, "Appointment completed successfully", appointment);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyAppointments, getMyAppointment, completeAppointment };
