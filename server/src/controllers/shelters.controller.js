const sheltersService = require("../services/shelters.service");
const { successResponse } = require("../utils/response");

// ——————————————— GET /shelters ———————————————
const getShelters = async (req, res, next) => {
  try {
    const shelters = await sheltersService.getShelters();
    return successResponse(res, "Shelters retrieved successfully", shelters);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getShelters };
