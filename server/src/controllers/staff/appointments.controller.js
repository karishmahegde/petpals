const appointmentsService = require("../../services/staff/appointments.service");
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

const MAX_REASON_LEN = 300; // schema.prisma: appointmentReason is VarChar(300)

// ——————————————— POST /appointments ———————————————
const createAppointment = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  let petID;
  let vetID;
  try {
    petID = parseId(body.petID, "petID");
    vetID = parseId(body.vetID, "vetID");
  } catch (err) {
    return next(err);
  }

  let volunteerID;
  if (body.volunteerID !== undefined && body.volunteerID !== null && body.volunteerID !== "") {
    try {
      volunteerID = parseId(body.volunteerID, "volunteerID");
    } catch (err) {
      return next(err);
    }
  }

  let staffID;
  if (body.staffID !== undefined && body.staffID !== null && body.staffID !== "") {
    try {
      staffID = parseId(body.staffID, "staffID");
    } catch (err) {
      return next(err);
    }
  }

  const { appointmentReason: reasonRaw, appointmentDate: dateRaw } = body;
  if (
    typeof reasonRaw !== "string" ||
    reasonRaw.trim().length === 0 ||
    reasonRaw.length > MAX_REASON_LEN
  ) {
    return next(
      badRequest(
        `appointmentReason must be a non-empty string of at most ${MAX_REASON_LEN} characters`,
      ),
    );
  }

  const appointmentDate = new Date(dateRaw);
  if (Number.isNaN(appointmentDate.getTime())) {
    return next(badRequest("appointmentDate must be a valid date"));
  }
  if (appointmentDate.getTime() < Date.now()) {
    return next(badRequest("appointmentDate must not be in the past"));
  }

  // Staff always creates at their own shelter — shelterID isn't even read
  // from the body for that role, let alone required. Admin has no home
  // shelter of their own, so it's required and validated here.
  let requestedShelterID;
  if (req.user.role === "Admin") {
    requestedShelterID = Number(body.shelterID);
    if (!Number.isInteger(requestedShelterID) || requestedShelterID < 1) {
      return next(badRequest("shelterID is required and must be a positive integer"));
    }
  }

  try {
    const appointment = await appointmentsService.createAppointment({
      data: {
        petID,
        vetID,
        volunteerID,
        staffID,
        appointmentDate,
        appointmentReason: reasonRaw.trim(),
      },
      actor: { role: req.user.role, userID: req.user.userID },
      requestedShelterID,
    });
    return successResponse(res, "Appointment created successfully", appointment, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /appointments ———————————————
const listAppointments = async (req, res, next) => {
  const {
    vetID: vetIDRaw,
    petName,
    upcoming: upcomingRaw,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  let vetID;
  if (vetIDRaw !== undefined) {
    vetID = Number(vetIDRaw);
    if (!Number.isInteger(vetID) || vetID < 1) {
      return next(badRequest("vetID must be a positive integer"));
    }
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
    const result = await appointmentsService.listShelterAppointments(
      { role: req.user.role, userID: req.user.userID },
      { vetID, petName, upcoming, shelterID, page, limit },
    );
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

// ——————————————— GET /appointments/:id ———————————————
const getAppointment = async (req, res, next) => {
  let appointmentID;
  try {
    appointmentID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const appointment = await appointmentsService.getShelterAppointmentDetail(
      appointmentID,
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, "Appointment retrieved successfully", appointment);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /appointments/:id ———————————————
// Partial update of a Scheduled, upcoming appointment. petID/shelterID/status
// are rejected outright rather than silently ignored, so a caller never
// thinks they moved an appointment to another pet or marked it done.
const LOCKED_FIELDS = ["petID", "shelterID", "appointmentStatus", "status"];

const updateAppointment = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  let appointmentID;
  try {
    appointmentID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  const locked = LOCKED_FIELDS.filter((field) => field in body);
  if (locked.length > 0) {
    return next(badRequest(`These fields can't be edited: ${locked.join(", ")}`));
  }

  const data = {};
  try {
    if (body.vetID !== undefined) data.vetID = parseId(body.vetID, "vetID");
    if (body.staffID !== undefined) data.staffID = parseId(body.staffID, "staffID");
    if (body.volunteerID !== undefined) {
      data.volunteerID =
        body.volunteerID === null || body.volunteerID === ""
          ? null
          : parseId(body.volunteerID, "volunteerID");
    }
  } catch (err) {
    return next(err);
  }

  if (body.appointmentReason !== undefined) {
    const reasonRaw = body.appointmentReason;
    if (
      typeof reasonRaw !== "string" ||
      reasonRaw.trim().length === 0 ||
      reasonRaw.length > MAX_REASON_LEN
    ) {
      return next(
        badRequest(
          `appointmentReason must be a non-empty string of at most ${MAX_REASON_LEN} characters`,
        ),
      );
    }
    data.appointmentReason = reasonRaw.trim();
  }

  if (body.appointmentDate !== undefined) {
    const appointmentDate = new Date(body.appointmentDate);
    if (Number.isNaN(appointmentDate.getTime())) {
      return next(badRequest("appointmentDate must be a valid date"));
    }
    if (appointmentDate.getTime() < Date.now()) {
      return next(badRequest("appointmentDate must not be in the past"));
    }
    data.appointmentDate = appointmentDate;
  }

  if (Object.keys(data).length === 0) {
    return next(
      badRequest(
        "Provide at least one of: vetID, staffID, volunteerID, appointmentDate, appointmentReason",
      ),
    );
  }

  try {
    const appointment = await appointmentsService.updateAppointment(appointmentID, data, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Appointment updated successfully", appointment);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /appointments/:id/cancel ———————————————
const cancelAppointment = async (req, res, next) => {
  let appointmentID;
  try {
    appointmentID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const appointment = await appointmentsService.cancelAppointment(appointmentID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Appointment cancelled successfully", appointment);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /appointments/vets, /appointments/volunteers, /appointments/staff ———————————————
const parseOptionalShelterID = (req, next) => {
  const { shelterID: shelterIDRaw } = req.query;
  if (req.user.role !== "Admin" || shelterIDRaw === undefined) return undefined;
  const shelterID = Number(shelterIDRaw);
  if (!Number.isInteger(shelterID) || shelterID < 1) {
    next(badRequest("shelterID must be a positive integer"));
    return null;
  }
  return shelterID;
};

const listVets = async (req, res, next) => {
  const shelterID = parseOptionalShelterID(req, next);
  if (shelterID === null) return;
  try {
    const vets = await appointmentsService.listShelterVets(
      { role: req.user.role, userID: req.user.userID },
      shelterID,
    );
    return successResponse(res, "Vets retrieved successfully", vets);
  } catch (err) {
    return next(err);
  }
};

const listVolunteers = async (req, res, next) => {
  const shelterID = parseOptionalShelterID(req, next);
  if (shelterID === null) return;
  try {
    const volunteers = await appointmentsService.listShelterVolunteers(
      { role: req.user.role, userID: req.user.userID },
      shelterID,
    );
    return successResponse(res, "Volunteers retrieved successfully", volunteers);
  } catch (err) {
    return next(err);
  }
};

const listStaff = async (req, res, next) => {
  const shelterID = parseOptionalShelterID(req, next);
  if (shelterID === null) return;
  try {
    const staff = await appointmentsService.listShelterStaff(
      { role: req.user.role, userID: req.user.userID },
      shelterID,
    );
    return successResponse(res, "Staff retrieved successfully", staff);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  listVets,
  listVolunteers,
  listStaff,
};
