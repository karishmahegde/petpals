const analyticsService = require("../../services/admin/analytics.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /analytics/overview ———————————————
const getOverview = async (req, res, next) => {
  try {
    const overview = await analyticsService.getOverview();
    return successResponse(
      res,
      "Overview analytics retrieved successfully",
      overview,
    );
  } catch (err) {
    return next(err);
  }
};

const SHELTER_SORT_VALUES = ["utilization", "petCount"];

// ——————————————— GET /analytics/shelters ———————————————
const getShelterBreakdown = async (req, res, next) => {
  const { sortBy } = req.query;

  if (sortBy !== undefined && !SHELTER_SORT_VALUES.includes(sortBy)) {
    return next(
      badRequest(`sortBy must be one of: ${SHELTER_SORT_VALUES.join(", ")}`),
    );
  }

  try {
    const breakdown = await analyticsService.getShelterBreakdown(sortBy);
    return successResponse(
      res,
      "Shelter analytics retrieved successfully",
      breakdown,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { getOverview, getShelterBreakdown };
