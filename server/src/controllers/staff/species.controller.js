const speciesService = require("../../services/staff/species.service");
const { successResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const NAME_MAX = 45; // schema.prisma: speciesName/breedName are VarChar(45)

const parseName = (value, field) => {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > NAME_MAX) {
    throw badRequest(`${field} is required and must be at most ${NAME_MAX} characters`);
  }
  return value.trim();
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return n;
};

// ——————————————— POST /species ———————————————
const createSpecies = async (req, res, next) => {
  let speciesName;
  try {
    speciesName = parseName(req.body?.speciesName, "speciesName");
  } catch (err) {
    return next(err);
  }

  try {
    const species = await speciesService.createSpecies({ speciesName });
    return successResponse(res, "Species created successfully", species, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /breeds ———————————————
const createBreed = async (req, res, next) => {
  let speciesID;
  let breedName;
  try {
    speciesID = parseId(req.body?.speciesID, "speciesID");
    breedName = parseName(req.body?.breedName, "breedName");
  } catch (err) {
    return next(err);
  }

  try {
    const breed = await speciesService.createBreed({ speciesID, breedName });
    return successResponse(res, "Breed created successfully", breed, 201);
  } catch (err) {
    return next(err);
  }
};

module.exports = { createSpecies, createBreed };
