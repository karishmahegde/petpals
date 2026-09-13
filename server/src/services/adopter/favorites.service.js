const prisma = require("../../config/prisma");
const { isUniqueViolation } = require("../../utils/prismaErrors");
const {
  PET_DETAIL_SELECT,
  formatPetDetail,
} = require("../public/pets.service");

// ——————————————— ADD FAVORITE (POST /pets/:id/favorites) ———————————————
const addFavorite = async (adopterID, petID) => {
  const pet = await prisma.pet.findUnique({
    where: { petID },
    select: { petID: true },
  });
  if (!pet) {
    const err = new Error(`No pet exists with ID ${petID}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  try {
    return await prisma.favorite.create({
      data: { adopterID, petID },
      select: { adopterID: true, petID: true },
    });
  } catch (err) {
    // Composite PK (adopterID, petID) already exists.
    if (isUniqueViolation(err)) {
      const e = new Error("This pet is already in your favorites");
      e.code = "CONFLICT";
      throw e;
    }
    throw err;
  }
};

// ——————————————— REMOVE FAVORITE (DELETE /pets/:id/favorites) ———————————————
const removeFavorite = async (adopterID, petID) => {
  try {
    await prisma.favorite.delete({
      where: { adopterID_petID: { adopterID, petID } },
    });
  } catch (err) {
    if (err.code === "P2025") {
      const e = new Error("This pet is not in your favorites");
      e.code = "NOT_FOUND";
      throw e;
    }
    throw err;
  }
};

// ——————————————— LIST FAVORITES (GET /adopters/me/favorites) ———————————————
// The Favorite junction has no timestamp, so ordering is alphabetical by pet
// name rather than "recently favorited".
const listFavorites = async (adopterID, { page = 1, limit = 20 } = {}) => {
  const where = { adopterID };

  const [rows, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      select: { pet: { select: PET_DETAIL_SELECT } },
      orderBy: { pet: { petName: "asc" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.favorite.count({ where }),
  ]);

  return {
    data: rows.map((row) => formatPetDetail(row.pet)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

module.exports = { addFavorite, removeFavorite, listFavorites };
