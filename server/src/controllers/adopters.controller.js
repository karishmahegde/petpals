const adoptersService = require("../services/adopters.service");
const { successResponse } = require("../utils/response");

// ——————————————— GET /adopters/me ———————————————
const getMe = async (req, res, next) => {
  try {
    const adopter = await adoptersService.getAdopterProfile(req.user.userID);
    return successResponse(res, "Adopter profile retrieved successfully", adopter);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getMe };
