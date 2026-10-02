const petsService = require("../../services/vet/pets.service");
const { parseShelterPetsQuery } = require("../staff/pets.controller");
const { successListResponse } = require("../../utils/response");

// ——————————————— GET /vets/me/pets ———————————————
// Same query params as the Staff GET /staff/me/pets (same parser), plus
// petName as on GET /appointments. The detail and health-passport routes
// reuse the Staff controller handlers directly — staff/pets.service.js's
// getShelterPetDetail scopes a Veterinarian to their own shelter.
const listMyShelterPets = async (req, res, next) => {
  try {
    const filters = parseShelterPetsQuery(req.query);
    const petName =
      typeof req.query.petName === "string" ? req.query.petName.trim() : "";
    const { data, pagination } = await petsService.listMyShelterPets(
      req.user.userID,
      { ...filters, petName: petName || undefined },
    );
    return successListResponse(res, "Pets retrieved successfully", data, pagination);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyShelterPets };
