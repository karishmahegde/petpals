const transfersService = require("../../services/staff/transfers.service");
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

const MAX_TRANSFER_REASON_LEN = 300; // schema.prisma: transferReason is VarChar(300)
const VALID_DIRECTIONS = ["incoming", "outgoing"];
const VALID_STATUS_FILTERS = ["In_Progress", "Completed", "Rejected", "Cancelled"];
const VALID_TARGET_STATUSES = ["Completed", "Rejected", "Cancelled"];

// ——————————————— POST /transfers ———————————————
const createTransfer = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  let petID;
  let toShelterID;
  try {
    petID = parseId(body.petID, "petID");
    toShelterID = parseId(body.toShelterID, "toShelterID");
  } catch (err) {
    return next(err);
  }

  const { transferReason: transferReasonRaw } = body;
  if (
    typeof transferReasonRaw !== "string" ||
    transferReasonRaw.trim().length === 0 ||
    transferReasonRaw.length > MAX_TRANSFER_REASON_LEN
  ) {
    return next(
      badRequest(
        `transferReason must be a non-empty string of at most ${MAX_TRANSFER_REASON_LEN} characters`,
      ),
    );
  }

  // Staff always transfers from their own shelter — fromShelterID isn't even
  // read from the body for that role, let alone required. Admin has no home
  // shelter of their own, so it's required and validated here.
  let requestedShelterID;
  if (req.user.role === "Admin") {
    try {
      requestedShelterID = parseId(body.fromShelterID, "fromShelterID");
    } catch (err) {
      return next(err);
    }
  }

  try {
    const transfer = await transfersService.initiateTransfer({
      petID,
      data: { toShelterID, transferReason: transferReasonRaw.trim() },
      actor: { role: req.user.role, userID: req.user.userID },
      requestedShelterID,
    });
    return successResponse(res, "Transfer initiated successfully", transfer, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /transfers ———————————————
const listTransfers = async (req, res, next) => {
  const {
    direction,
    status,
    shelterName,
    petName,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  if (!VALID_DIRECTIONS.includes(direction)) {
    return next(
      badRequest(`direction is required and must be one of: ${VALID_DIRECTIONS.join(", ")}`),
    );
  }

  if (status !== undefined && !VALID_STATUS_FILTERS.includes(status)) {
    return next(
      badRequest(`status must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
    );
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
    const result = await transfersService.listTransfers(
      { role: req.user.role, userID: req.user.userID },
      { direction, status, shelterName, petName, shelterID, page, limit },
    );
    return successListResponse(
      res,
      "Transfers retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /transfers/:id ———————————————
const getTransfer = async (req, res, next) => {
  let recordID;
  try {
    recordID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const transfer = await transfersService.getTransferById(recordID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Transfer retrieved successfully", transfer);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /transfers/:id/status ———————————————
const updateTransferStatus = async (req, res, next) => {
  let recordID;
  try {
    recordID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  const { status } = req.body ?? {};
  if (!VALID_TARGET_STATUSES.includes(status)) {
    return next(
      badRequest(`status is required and must be one of: ${VALID_TARGET_STATUSES.join(", ")}`),
    );
  }

  try {
    const transfer = await transfersService.updateTransferStatus(
      recordID,
      { status },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, `Transfer ${status.toLowerCase()} successfully`, transfer);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /transfers/assignees ———————————————
// toShelterID optional — omitted, only the (from-side) acting staff member
// is resolved; the form calls it again once a destination is picked.
const getTransferAssignees = async (req, res, next) => {
  let toShelterID;
  if (req.query.toShelterID !== undefined) {
    try {
      toShelterID = parseId(req.query.toShelterID, "toShelterID");
    } catch (err) {
      return next(err);
    }
  }

  try {
    const assignees = await transfersService.getTransferAssignees(
      { role: req.user.role, userID: req.user.userID },
      toShelterID,
    );
    return successResponse(res, "Transfer assignees retrieved successfully", assignees);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /transfers/:id ———————————————
const updateTransfer = async (req, res, next) => {
  let recordID;
  let toShelterStaff;
  try {
    recordID = parseId(req.params.id, "id");
    toShelterStaff = parseId(req.body?.toShelterStaff, "toShelterStaff");
  } catch (err) {
    return next(err);
  }

  try {
    const transfer = await transfersService.reassignToShelterStaff(
      recordID,
      { toShelterStaff },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, "Transfer staff reassigned successfully", transfer);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createTransfer,
  getTransferAssignees,
  listTransfers,
  getTransfer,
  updateTransferStatus,
  updateTransfer,
};
