const adoptionApplicationsService = require("../../services/adopter/adoptionApplications.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const forbidden = (message) => {
  const err = new Error(message);
  err.code = "FORBIDDEN";
  return err;
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return n;
};

// req.query gives a single string for one occurrence of a param, or an array
// when the param is repeated (?species=1&species=2) — normalize to array either way.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const VALID_APPLICATION_TYPES = ["Adopt", "Foster"];
const MAX_SHELTER_MESSAGE_LEN = 500; // schema.prisma: shelterMessage is VarChar(500)

// ——————————————— POST /adoption-applications ———————————————
const createApplication = async (req, res, next) => {
  let petID;
  let shelterID;
  try {
    petID = parseId(req.body?.petID, "petID");
    shelterID = parseId(req.body?.shelterID, "shelterID");
  } catch (err) {
    return next(err);
  }

  const { applicationType, shelterMessage: shelterMessageRaw } = req.body ?? {};
  if (!VALID_APPLICATION_TYPES.includes(applicationType)) {
    return next(
      badRequest(
        `applicationType is required and must be one of: ${VALID_APPLICATION_TYPES.join(", ")}`,
      ),
    );
  }

  let shelterMessage = null;
  if (shelterMessageRaw !== undefined && shelterMessageRaw !== null) {
    if (
      typeof shelterMessageRaw !== "string" ||
      shelterMessageRaw.length > MAX_SHELTER_MESSAGE_LEN
    ) {
      return next(
        badRequest(
          `shelterMessage must be a string of at most ${MAX_SHELTER_MESSAGE_LEN} characters`,
        ),
      );
    }
    shelterMessage = shelterMessageRaw.trim() || null;
  }

  try {
    // Creates a Stripe Checkout Session — the AdoptionApplication row
    // itself is only ever created by the webhook once payment is confirmed
    // (see adoptionApplications.service.js finalizeApplication).
    const { checkoutUrl } = await adoptionApplicationsService.createCheckoutSession({
      adopterID: req.user.userID,
      petID,
      shelterID,
      applicationType,
      shelterMessage,
    });
    return successResponse(
      res,
      "Checkout session created successfully",
      { checkoutUrl },
      201,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adoption-applications ———————————————
// One path, two unrelated purposes distinguished by presence of
// checkoutSessionId — matches the original API design doc, which planned
// both as sharing this exact method+path rather than one shadowing the
// other. authorizeRoles on the route allows Adopter/Staff/Admin broadly;
// the actual role restriction per branch is enforced here, since each
// branch needs a different one and the middleware only supports one static
// list.
const VALID_SECTIONS = ["active", "past"];

// ?checkoutSessionId= — Adopter-only. Used by the post-payment confirmation
// page to poll for the row the webhook creates asynchronously.
const getByCheckoutSession = async (req, res, next) => {
  if (req.user.role !== "Adopter") {
    return next(forbidden("Only adopters can look up an application by checkout session"));
  }

  const sessionId = req.query?.checkoutSessionId;
  if (typeof sessionId !== "string" || !sessionId) {
    return next(badRequest("checkoutSessionId is required"));
  }

  try {
    const application = await adoptionApplicationsService.getApplicationByCheckoutSession(
      req.user.userID,
      sessionId,
    );
    // application is null while the webhook hasn't landed yet — that's the
    // expected common case for a poll, not an error.
    return successResponse(
      res,
      application
        ? "Adoption application found"
        : "No adoption application found for this checkout session yet",
      application,
    );
  } catch (err) {
    return next(err);
  }
};

// No checkoutSessionId — Staff/Admin-only. The shelter's application queue.
const listApplications = async (req, res, next) => {
  if (req.user.role !== "Staff" && req.user.role !== "Admin") {
    return next(forbidden("Only staff or admin can list adoption applications"));
  }

  const {
    section,
    species,
    adopterName,
    petName,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

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

  if (!VALID_SECTIONS.includes(section)) {
    return next(badRequest(`section is required and must be one of: ${VALID_SECTIONS.join(", ")}`));
  }

  // species is numeric (speciesID) — same conversion/validation as public
  // GET /pets's own species param. Without this, Prisma rejects the string
  // query-param values matchFilter passes through.
  const speciesValues = toArray(species).map((raw) => Number(raw));
  if (speciesValues.some((s) => !Number.isInteger(s))) {
    return next(badRequest("species must be an array of integers (speciesID)"));
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
    const result = await adoptionApplicationsService.listApplicationsForStaff(
      { role: req.user.role, userID: req.user.userID },
      { section, species: speciesValues, adopterName, petName, shelterID, page, limit },
    );
    return successListResponse(
      res,
      "Adoption applications retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// Dispatches on checkoutSessionId presence — see the design note above.
const getApplications = (req, res, next) => {
  if (req.query?.checkoutSessionId !== undefined) {
    return getByCheckoutSession(req, res, next);
  }
  return listApplications(req, res, next);
};

// ——————————————— GET /adoption-applications/:id ———————————————
const getApplication = async (req, res, next) => {
  let applicationID;
  try {
    applicationID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const application = await adoptionApplicationsService.getApplicationById(
      applicationID,
      req.user,
    );
    return successResponse(
      res,
      "Adoption application retrieved successfully",
      application,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /adoption-applications/:id/status ———————————————
// Adopters may only move their own application to 'Withdrawn'. Staff/Admin
// may only move a Pending application to 'Accepted' or 'Rejected'. Which
// list applies is determined by role, not by a shared enum — an Adopter
// sending "Accepted" should get the same validation error shape as sending
// any other bogus value, not a 403 that leaks that the value is valid for
// someone else.
const VALID_ADOPTER_STATUS_CHANGES = ["Withdrawn"];
const VALID_STAFF_STATUS_CHANGES = ["Accepted", "Rejected"];
const MAX_STAFF_REMARK_LEN = 500; // schema.prisma: staffRemark is VarChar(500)

const updateApplicationStatus = async (req, res, next) => {
  let applicationID;
  try {
    applicationID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  const isStaffActor = req.user.role === "Staff" || req.user.role === "Admin";
  const allowedStatuses = isStaffActor
    ? VALID_STAFF_STATUS_CHANGES
    : VALID_ADOPTER_STATUS_CHANGES;

  const { status, staffRemark: staffRemarkRaw } = req.body ?? {};
  if (!allowedStatuses.includes(status)) {
    return next(
      badRequest(`status is required and must be one of: ${allowedStatuses.join(", ")}`),
    );
  }

  // staffRemark is staff-authored (schema.prisma design note) — only read
  // from the body at all for the Staff/Admin branch, never for Adopter.
  let staffRemark;
  if (isStaffActor && staffRemarkRaw !== undefined && staffRemarkRaw !== null) {
    if (typeof staffRemarkRaw !== "string" || staffRemarkRaw.length > MAX_STAFF_REMARK_LEN) {
      return next(
        badRequest(
          `staffRemark must be a string of at most ${MAX_STAFF_REMARK_LEN} characters`,
        ),
      );
    }
    staffRemark = staffRemarkRaw.trim() || null;
  }

  try {
    const application = await adoptionApplicationsService.updateApplicationStatus(
      applicationID,
      { status, staffRemark },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(
      res,
      `Adoption application ${status.toLowerCase()} successfully`,
      application,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /adoption-applications/:id ———————————————
const updateApplication = async (req, res, next) => {
  let applicationID;
  let staffID;
  try {
    applicationID = parseId(req.params.id, "id");
    staffID = parseId(req.body?.staffID, "staffID");
  } catch (err) {
    return next(err);
  }

  try {
    const application = await adoptionApplicationsService.assignApplicationStaff(
      applicationID,
      { staffID },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, "Application staff assigned successfully", application);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createApplication,
  getApplications,
  getApplication,
  updateApplicationStatus,
  updateApplication,
};
