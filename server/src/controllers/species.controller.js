const speciesService = require("../services/species.service");
const { successResponse } = require("../utils/response");

// ——————————————— GET /species ———————————————
const getSpecies = async (req, res, next) => {
  try {
    const species = await speciesService.getSpecies();
    return successResponse(res, "Species retrieved successfully", species);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getSpecies };
