const adoptionApplicationsService = require("../../services/adopter/adoptionApplications.service");
const { successResponse } = require("../../utils/response");

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

// ——————————————— POST /adoption-applications ———————————————
const createApplication = async (req, res, next) => {
  let petID;
  let shelterID;
  try {
    petID = parseId(req.body?.petID, "petID");
    shelterID = parseId(req.body?.shelterID, "shelterID");
  } catch (err) {
    return next(err);
  }

  try {
    const application = await adoptionApplicationsService.createApplication({
      adopterID: req.user.userID,
      petID,
      shelterID,
    });
    return successResponse(
      res,
      "Adoption application submitted successfully",
      application,
      201,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adoption-applications/:id ———————————————
const getApplication = async (req, res, next) => {
  let applicationID;
  try {
    applicationID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const application = await adoptionApplicationsService.getApplicationById(
      applicationID,
      req.user,
    );
    return successResponse(
      res,
      "Adoption application retrieved successfully",
      application,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { createApplication, getApplication };
