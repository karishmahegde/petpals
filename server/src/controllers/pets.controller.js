const petsService = require("../services/pets.service");
const { successResponse, successListResponse } = require("../utils/response");

const VALID_SIZES = ["Small", "Medium", "Large"];

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// req.query gives a single string for one occurrence of a param, or an array
// when the param is repeated (?size=Small&size=Medium) — normalize to array either way.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

// ——————————————— GET /pets ———————————————
const getAvailablePets = async (req, res, next) => {
  const {
    page: pageRaw,
    limit: limitRaw, // pagination page-size parameter - controls how many pets are returned per page of results
    species,
    breed,
    size,
    minAge: minAgeRaw, // in MONTHS, not years — see pets.service.js buildAgeFilter
    maxAge: maxAgeRaw, // in MONTHS, not years — see pets.service.js buildAgeFilter
    shelterID: shelterIDRaw,
  } = req.query;

  // VALIDATE THE QUERY PARAMETERS
  let page = 1;
  if (pageRaw !== undefined) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return next(badRequest("page must be an integer >= 1"));
    }
  }

  let limit = 20;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return next(badRequest("limit must be an integer between 1 and 100"));
    }
  }

  const sizeValues = toArray(size);
  if (sizeValues.some((s) => !VALID_SIZES.includes(s))) {
    return next(badRequest(`size must be one of: ${VALID_SIZES.join(", ")}`));
  }

  // species is now numeric (speciesID), matching the /breeds convention.
  // Strict validation, matching minAge/maxAge — a non-numeric value is
  // rejected outright rather than silently coerced.
  const speciesValues = toArray(species).map((raw) => Number(raw));
  if (speciesValues.some((s) => !Number.isInteger(s))) {
    return next(badRequest("species must be an array of integers (speciesID)"));
  }

  // minAge/maxAge are in MONTHS (e.g. minAge=6 means "at least 6 months old").
  // Integer validation is unaffected by the months-vs-years change — a whole
  // number of months is still the correct constraint.
  let minAge;
  if (minAgeRaw !== undefined) {
    minAge = Number(minAgeRaw);
    if (!Number.isInteger(minAge)) {
      return next(badRequest("minAge must be an integer (in months)"));
    }
  }

  let maxAge;
  if (maxAgeRaw !== undefined) {
    maxAge = Number(maxAgeRaw);
    if (!Number.isInteger(maxAge)) {
      return next(badRequest("maxAge must be an integer (in months)"));
    }
  }

  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    return next(badRequest("minAge must be less than or equal to maxAge"));
  }

  // shelterID is not validated per spec — a non-numeric value is coerced to an
  // ID that can never match, so the query naturally returns 0 results instead of erroring.
  const shelterIDValues = toArray(shelterIDRaw).map((raw) => {
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : -1;
  });

  try {
    const result = await petsService.getAvailablePets(
      {
        species: speciesValues,
        breed: toArray(breed),
        size: sizeValues,
        minAge,
        maxAge,
        shelterID: shelterIDValues,
      },
      { page, limit },
    );
    return successListResponse(
      res,
      "Pets retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /pets/featured ———————————————
const getFeaturedPets = async (req, res, next) => {
  try {
    const result = await petsService.getFeaturedPets();
    return successResponse(res, "Featured pets retrieved successfully", result);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /pets/:id ———————————————
const getPetDetails = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return next(badRequest("id must be a positive integer"));
  }
  try {
    const pet = await petsService.getPetDetails(id);
    return successResponse(res, "Pet retrieved successfully", pet);
  } catch (err) {
    return next(err);
  }
};

module.exports = { getAvailablePets, getFeaturedPets, getPetDetails };
