const vaccinationsService = require("../../services/vet/vaccinations.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const validationError = (message) => {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  return err;
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return n;
};

const parseDate = (value, field) => {
  const date = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} is required and must be a valid date`);
  }
  return date;
};

const actorOf = (req) => ({ role: req.user.role, userID: req.user.userID });

// ——————————————— GET /vaccines ———————————————
// Optional ?name= — open/free-text, so unmatched just means zero rows.
const listVaccines = async (req, res, next) => {
  try {
    const name =
      typeof req.query.name === "string" ? req.query.name.trim() : "";
    const vaccines = await vaccinationsService.listVaccines({
      name: name || undefined,
    });
    return successResponse(res, "Vaccines retrieved successfully", vaccines);
  } catch (err) {
    return next(err);
  }
};

// schema.prisma: Vaccine.vaccineName/manufacturer VarChar(45), vaccineDesc
// VarChar(500). vaccineName is required; the other two are optional, and
// "" or null clears them.
const VACCINE_FIELDS = {
  vaccineName: { max: 45, required: true },
  manufacturer: { max: 45, required: false },
  vaccineDesc: { max: 500, required: false },
};

// Picks and validates the vaccine fields present in the body (all of them
// when `partial` is false). Wrong types are 400; too long is 422.
const parseVaccineFields = (rawBody, { partial }) => {
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};
  const fields = {};

  Object.entries(VACCINE_FIELDS).forEach(([key, { max, required }]) => {
    if (partial && !(key in body)) return;
    const raw = body[key];

    if (raw === undefined || raw === null || raw === "") {
      if (required) throw badRequest(`${key} is required`);
      fields[key] = null;
      return;
    }
    if (typeof raw !== "string") {
      throw badRequest(`${key} must be a string`);
    }
    const value = raw.trim();
    if (!value) {
      if (required) throw badRequest(`${key} is required`);
      fields[key] = null;
      return;
    }
    if (value.length > max) {
      throw validationError(`${key} must be at most ${max} characters`);
    }
    fields[key] = value;
  });

  if (partial && Object.keys(fields).length === 0) {
    throw badRequest(
      "Send at least one of vaccineName, manufacturer, vaccineDesc",
    );
  }
  return fields;
};

// ——————————————— POST /vaccines ———————————————
const createVaccine = async (req, res, next) => {
  try {
    const fields = parseVaccineFields(req.body, { partial: false });
    const vaccine = await vaccinationsService.createVaccine(fields);
    return successResponse(res, "Vaccine created successfully", vaccine, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /vaccines/:id ———————————————
const updateVaccine = async (req, res, next) => {
  try {
    const vaccineID = parseId(req.params.id, "id");
    const fields = parseVaccineFields(req.body, { partial: true });
    const vaccine = await vaccinationsService.updateVaccine(vaccineID, fields);
    return successResponse(res, "Vaccine updated successfully", vaccine);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /appointments/:id/vaccinations ———————————————
const listAppointmentVaccinations = async (req, res, next) => {
  try {
    const appointmentID = parseId(req.params.id, "id");
    const doses = await vaccinationsService.listAppointmentVaccinations(
      actorOf(req),
      appointmentID,
    );
    return successResponse(res, "Vaccinations retrieved successfully", doses);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /appointments/:id/vaccinations ———————————————
// Missing/malformed fields are 400; well-formed dates that break the rules
// (a future administeredDate, a dueDate not after it) are 422. dueDate is
// optional — omitted or null means no further dose is planned.
const recordVaccination = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  try {
    const appointmentID = parseId(req.params.id, "id");
    const vaccineID = parseId(body.vaccineID, "vaccineID");
    const administeredDate = parseDate(body.administeredDate, "administeredDate");
    const dueDate =
      body.dueDate === undefined || body.dueDate === null || body.dueDate === ""
        ? null
        : parseDate(body.dueDate, "dueDate");

    if (administeredDate.getTime() > Date.now()) {
      throw validationError("administeredDate can't be in the future");
    }
    if (dueDate && dueDate.getTime() <= administeredDate.getTime()) {
      throw validationError("dueDate must be after administeredDate");
    }

    const dose = await vaccinationsService.recordVaccination(
      req.user.userID,
      appointmentID,
      { vaccineID, administeredDate, dueDate },
    );
    return successResponse(res, "Vaccination recorded successfully", dose, 201);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listVaccines,
  createVaccine,
  updateVaccine,
  listAppointmentVaccinations,
  recordVaccination,
};
