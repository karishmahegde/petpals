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
const listVaccines = async (req, res, next) => {
  try {
    const vaccines = await vaccinationsService.listVaccines();
    return successResponse(res, "Vaccines retrieved successfully", vaccines);
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

module.exports = { listVaccines, listAppointmentVaccinations, recordVaccination };
