const breedsService = require("../services/breeds.service");
const { successResponse } = require("../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// req.query gives a single string for one occurrence of a param, or an array
// when the param is repeated (?speciesID=1&speciesID=2) — normalize to array either way.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

// ——————————————— GET /breeds ———————————————
const getBreeds = async (req, res, next) => {
  const speciesIDRaw = toArray(req.query.speciesID);

  const speciesIDs = [];
  for (const raw of speciesIDRaw) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return next(badRequest("speciesID must be a positive integer"));
    }
    speciesIDs.push(parsed);
  }

  // No speciesID provided (or all filtered out) — return empty data without
  // hitting the DB; a non-existent-but-valid speciesID still reaches the
  // service and naturally yields 0 rows there.
  if (speciesIDs.length === 0) {
    return successResponse(res, "Breeds retrieved successfully", []);
  }

  try {
    const breeds = await breedsService.getBreeds(speciesIDs);
    return successResponse(res, "Breeds retrieved successfully", breeds);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getBreeds };
