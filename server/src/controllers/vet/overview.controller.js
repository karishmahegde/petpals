const overviewService = require("../../services/vet/overview.service");
const { successResponse } = require("../../utils/response");

// ——————————————— GET /vets/me/vaccinations/overdue ———————————————
const listOverdueVaccinations = async (req, res, next) => {
  try {
    const overdue = await overviewService.listOverdueVaccinations(req.user.userID);
    return successResponse(res, "Overdue vaccinations retrieved successfully", overdue);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /vets/me/stats ———————————————
const getMyStats = async (req, res, next) => {
  try {
    const stats = await overviewService.getMyStats(req.user.userID);
    return successResponse(res, "Stats retrieved successfully", stats);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listOverdueVaccinations, getMyStats };
