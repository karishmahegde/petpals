const summaryService = require("../../services/staff/healthPassportSummary.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /pets/:id/health-passport/summary ———————————————
const getPassportSummary = async (req, res, next) => {
  const petID = Number(req.params.id);
  if (!Number.isInteger(petID) || petID < 1) {
    return next(badRequest("id must be a positive integer"));
  }

  try {
    const summary = await summaryService.getPassportSummary(petID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(
      res,
      summary.aiAvailable ? "Health passport summary retrieved successfully" : "AI is not configured",
      summary,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { getPassportSummary };
