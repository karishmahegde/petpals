const vetsService = require("../../services/staff/vets.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("id must be a positive integer");
  }
  return n;
};

const VALID_SECTIONS = ["all", "pending"];
const VALID_STATUS_FILTERS = ["Active", "Deactivated"];
const VALID_TARGET_STATUSES = ["Active", "Deactivated"];

// ——————————————— GET /staff/me/vets ———————————————
const listVets = async (req, res, next) => {
  const { section, accountStatus, name, page: pageRaw, limit: limitRaw } = req.query;

  if (!VALID_SECTIONS.includes(section)) {
    return next(
      badRequest(`section is required and must be one of: ${VALID_SECTIONS.join(", ")}`),
    );
  }
  if (accountStatus !== undefined && !VALID_STATUS_FILTERS.includes(accountStatus)) {
    return next(
      badRequest(`accountStatus must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
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

  try {
    const result = await vetsService.listVets(req.user.userID, {
      section,
      accountStatus,
      name: typeof name === "string" ? name.trim() : undefined,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Veterinarians retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /staff/me/vets/:id/status ———————————————
const updateVetStatus = async (req, res, next) => {
  let vetID;
  try {
    vetID = parseId(req.params.id);
  } catch (err) {
    return next(err);
  }

  const { accountStatus } = req.body ?? {};
  if (!VALID_TARGET_STATUSES.includes(accountStatus)) {
    return next(
      badRequest(
        `accountStatus is required and must be one of: ${VALID_TARGET_STATUSES.join(", ")}`,
      ),
    );
  }

  try {
    const vet = await vetsService.updateVetStatus(req.user.userID, vetID, accountStatus);
    return successResponse(res, "Veterinarian status updated successfully", vet);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listVets, updateVetStatus };
