const visitsService = require("../../services/adopter/visits.service");
const { successResponse } = require("../../utils/response");

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

// ——————————————— PATCH /visits/:id ———————————————
const cancelVisit = async (req, res, next) => {
  let visitID;
  try {
    visitID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  // Adopters may only cancel — no other status transition is exposed here.
  if (req.body?.visitStatus !== "Cancelled") {
    return next(badRequest('visitStatus is required and must be "Cancelled"'));
  }

  try {
    const visit = await visitsService.cancelVisit(visitID, req.user.userID);
    return successResponse(res, "Visit cancelled successfully", visit);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createVisit, cancelVisit };
