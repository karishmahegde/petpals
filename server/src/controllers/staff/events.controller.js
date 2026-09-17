const eventsService = require("../../services/staff/events.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const STRING_MAX = {
  eventName: 45,
  eventDesc: 300,
};

// eventLocation is not client-writable — staff/events.service.js's
// createEvent auto-assigns it from the resolved shelter's name, and it
// can't be reassigned on PUT since shelterID reassignment is out of scope
// there too. Nothing here for staff to submit for it, on either route.
const CREATE_REQUIRED_FIELDS = ["eventName", "eventDesc", "eventDate"];
const UPDATABLE_FIELDS = ["eventName", "eventDesc", "eventDate"];

// Shared by create (every required field present) and update (only present
// fields are checked) so the two routes can't drift on what counts as
// valid. Same pattern as staff/pets.controller.js's validateField.
const validateField = (field, rawValue) => {
  switch (field) {
    case "eventName":
    case "eventDesc":
      if (
        typeof rawValue !== "string" ||
        rawValue.trim().length === 0 ||
        rawValue.length > STRING_MAX[field]
      ) {
        throw badRequest(
          `${field} must be a non-empty string of at most ${STRING_MAX[field]} characters`,
        );
      }
      return rawValue.trim();

    case "eventDate": {
      const parsed = new Date(rawValue);
      if (Number.isNaN(parsed.getTime())) {
        throw badRequest("eventDate must be a valid date");
      }
      return parsed;
    }

    default:
      return rawValue;
  }
};

// ——————————————— POST /events ———————————————
const createEvent = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const missing = CREATE_REQUIRED_FIELDS.filter((field) => !(field in body));
  if (missing.length > 0) {
    return next(badRequest(`Missing required field(s): ${missing.join(", ")}`));
  }

  const data = {};
  try {
    for (const field of CREATE_REQUIRED_FIELDS) {
      data[field] = validateField(field, body[field]);
    }
  } catch (err) {
    return next(err);
  }

  if (data.eventDate.getTime() < Date.now()) {
    return next(badRequest("eventDate must not be in the past"));
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
    const event = await eventsService.createEvent({
      data,
      actor: { role: req.user.role, userID: req.user.userID },
      requestedShelterID,
    });
    return successResponse(res, "Event created successfully", event, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PUT /events/:id ———————————————
const updateEvent = async (req, res, next) => {
  const eventID = Number(req.params.id);
  if (!Number.isInteger(eventID) || eventID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const data = {};
  try {
    for (const field of UPDATABLE_FIELDS) {
      if (!(field in body)) continue; // partial update — only touch provided fields
      data[field] = validateField(field, body[field]);
    }
  } catch (err) {
    return next(err);
  }

  if (Object.keys(data).length === 0) {
    return next(badRequest("No updatable fields provided"));
  }

  try {
    const event = await eventsService.updateEvent(eventID, data, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Event updated successfully", event);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /events/:id ———————————————
const deleteEvent = async (req, res, next) => {
  const eventID = Number(req.params.id);
  if (!Number.isInteger(eventID) || eventID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    await eventsService.deleteEvent(eventID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Event deleted successfully", null);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createEvent, updateEvent, deleteEvent };
