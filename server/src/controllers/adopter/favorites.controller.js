const favoritesService = require("../../services/adopter/favorites.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parsePetId = (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("pet id must be a positive integer");
  }
  return n;
};

// ——————————————— POST /pets/:id/favorites ———————————————
const addFavorite = async (req, res, next) => {
  let petID;
  try {
    petID = parsePetId(req.params.id);
  } catch (err) {
    return next(err);
  }

  try {
    const favorite = await favoritesService.addFavorite(req.user.userID, petID);
    return successResponse(res, "Pet added to favorites", favorite, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— DELETE /pets/:id/favorites ———————————————
const removeFavorite = async (req, res, next) => {
  let petID;
  try {
    petID = parsePetId(req.params.id);
  } catch (err) {
    return next(err);
  }

  try {
    await favoritesService.removeFavorite(req.user.userID, petID);
    return successResponse(res, "Pet removed from favorites", null);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /adopters/me/favorites ———————————————
const listFavorites = async (req, res, next) => {
  const { page: pageRaw, limit: limitRaw } = req.query;

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

  try {
    const result = await favoritesService.listFavorites(req.user.userID, {
      page,
      limit,
    });
    return successListResponse(
      res,
      "Favorites retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

module.exports = { addFavorite, removeFavorite, listFavorites };
