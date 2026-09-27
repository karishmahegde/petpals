const adoptersService = require("../../services/admin/adopters.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const ADOPTER_ACCOUNT_STATUS_VALUES = ["Active", "Banned", "Deactivated"];

// ——————————————— GET /adopters ———————————————
const listAdopters = async (req, res, next) => {
  const {
    accountStatus,
    adopterRiskFlag: adopterRiskFlagRaw,
    name,
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

  if (
    accountStatus !== undefined &&
    !ADOPTER_ACCOUNT_STATUS_VALUES.includes(accountStatus)
  ) {
    return next(
      badRequest(
        `accountStatus must be one of: ${ADOPTER_ACCOUNT_STATUS_VALUES.join(", ")}`,
      ),
    );
  }

  // Convenience flag — only the exact string "true" enables it, same
  // convention as the adopter visits/appointments "upcoming" filter.
  const adopterRiskFlag =
    adopterRiskFlagRaw === undefined
      ? undefined
      : adopterRiskFlagRaw === "true";

  try {
    const result = await adoptersService.listAdopters({
      accountStatus,
      adopterRiskFlag,
      name: typeof name === "string" ? name.trim() || undefined : undefined,
      page,
      limit,
    });
    return successListResponse(
      res,
      "Adopters retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/:id ———————————————
const getAdopter = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const adopter = await adoptersService.getAdopterDetail(userID);
    return successResponse(res, "Adopter retrieved successfully", adopter);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /adopters/:id/status ———————————————
const updateAdopterStatus = async (req, res, next) => {
  const userID = Number(req.params.id);
  if (!Number.isInteger(userID) || userID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  const { accountStatus } = req.body ?? {};
  if (!ADOPTER_ACCOUNT_STATUS_VALUES.includes(accountStatus)) {
    return next(
      badRequest(
        `accountStatus must be one of: ${ADOPTER_ACCOUNT_STATUS_VALUES.join(", ")}`,
      ),
    );
  }

  try {
    const adopter = await adoptersService.updateAdopterStatus(
      userID,
      accountStatus,
    );
    return successResponse(res, "Adopter status updated successfully", adopter);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listAdopters, getAdopter, updateAdopterStatus };
