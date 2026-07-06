const sheltersService = require("../services/shelters.service");
const { successResponse, errorResponse } = require("../utils/response");

// ——————————————— GET /shelters ———————————————
const getShelters = async (req, res, next) => {
  try {
    const shelters = await sheltersService.getShelters();
    return successResponse(res, "Shelters retrieved successfully", shelters);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /shelters/nearby ———————————————
const getNearbyShelters = async (req, res, next) => {
  const { lat: latRaw, lng: lngRaw, radius: radiusRaw } = req.query;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (
    latRaw === undefined ||
    lngRaw === undefined ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return errorResponse(
      res,
      "lat and lng are required and must be numeric",
      "BAD_REQUEST",
      "Missing or invalid lat/lng query parameters",
      400,
    );
  }

  // lat/lng range check — always runs, independent of radius
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return errorResponse(
      res,
      "lat must be between -90 and 90 and lng must be between -180 and 180",
      "BAD_REQUEST",
      "Invalid lat/lng query parameters",
      400,
    );
  }

  let radius = 25;
  if (radiusRaw !== undefined) {
    radius = Number(radiusRaw);
    if (Number.isNaN(radius)) {
      return errorResponse(
        res,
        "radius must be numeric",
        "BAD_REQUEST",
        "Invalid radius query parameter",
        400,
      );
    }
  }

  try {
    const shelters = await sheltersService.getNearbyShelters(lat, lng, radius);
    return successResponse(res, "Shelters retrieved successfully", shelters);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getShelters, getNearbyShelters };
