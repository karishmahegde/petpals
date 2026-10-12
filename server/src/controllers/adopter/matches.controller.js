const matchesService = require("../../services/adopter/matches.service");
const { SHORTLIST_SIZE } = require("../../config/matchScoring");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /adopters/me/matches ———————————————
// ?limit= 1–SHORTLIST_SIZE (the cache never holds more), default 3.
const getMyMatches = async (req, res, next) => {
  let limit = matchesService.TOP_MATCHES_DEFAULT_LIMIT;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > SHORTLIST_SIZE) {
      return next(badRequest(`limit must be an integer from 1 to ${SHORTLIST_SIZE}`));
    }
  }

  try {
    const result = await matchesService.getTopMatches(req.user.userID, { limit });
    return successResponse(
      res,
      result.quizComplete ? "Matches retrieved successfully" : "Quiz not taken yet",
      result,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { getMyMatches };
