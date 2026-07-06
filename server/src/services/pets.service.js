const prisma = require("../config/prisma");

// TODO(Trello): range-based filtering with PostGIS (shelter proximity) — placeholder for a future sprint

// Normalizes a filter value coming from req.query to array form: undefined -> [],
// a single value -> [value], an already-repeated query param -> passed through as-is.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

// One value -> exact match. Multiple values -> Prisma `in`. Empty -> no filter (caller skips it).
const matchFilter = (values) =>
  values.length === 1 ? values[0] : { in: values };

// ——————————————— GET AVAILABLE PETS ———————————————
const getAvailablePets = async (filters = {}, pagination = {}) => {
  const { species, breed, size, minAge, maxAge, shelterID } = filters; // optional filters based on which users can view available pets
  const { page = 1, limit = 20 } = pagination; // pagination based on which users can view available pets

  const speciesValues = toArray(species);
  const breedValues = toArray(breed);
  const sizeValues = toArray(size);
  const shelterIDValues = toArray(shelterID);

  const where = { adoptionStatus: "available" }; // where clause based on which users can view available pets - mandatory filter

  // species and breed both filter on the `breed` relation, so both conditions
  // are implicitly AND'd together (a pet must match both if both are provided).
  // Multiple values within each filter are OR'd via the `in` operator:
  // e.g. species=Dog&species=Cat returns pets where breed.species.speciesName IN ['Dog', 'Cat']
  const breedWhere = {};
  if (breedValues.length > 0) {
    breedWhere.breedName = matchFilter(breedValues);
  }
  if (speciesValues.length > 0) {
    breedWhere.species = { speciesName: matchFilter(speciesValues) };
  }
  if (Object.keys(breedWhere).length > 0) {
    where.breed = breedWhere;
  }

  if (sizeValues.length > 0) {
    where.petSize = matchFilter(sizeValues);
  }
  if (shelterIDValues.length > 0) {
    where.shelterID = matchFilter(shelterIDValues);
  }
  if (minAge !== undefined || maxAge !== undefined) {
    where.petAge = {
      ...(minAge !== undefined && { gte: minAge }),
      ...(maxAge !== undefined && { lte: maxAge }),
    };
  }

  const skip = (page - 1) * limit; // skip based on which users can view available pets

  const [pets, total] = await Promise.all([
    // Query 1: Fetch the paginated pets
    prisma.pet.findMany({
      where,
      skip,
      take: limit,
      select: {
        petID: true,
        petName: true,
        petAge: true,
        petPhoto: true,
        breed: {
          select: {
            breedName: true,
            species: { select: { speciesName: true } },
          },
        },
      },
    }),
    // Query 2: Count total pets matching the filter
    prisma.pet.count({ where }),
  ]);

  // Map the pets to the desired format
  const data = pets.map((pet) => ({
    petID: pet.petID,
    petName: pet.petName,
    petAge: pet.petAge,
    petPhoto: pet.petPhoto,
    breed: {
      breedName: pet.breed.breedName,
      speciesName: pet.breed.species.speciesName,
    },
  }));

  // Return the data and pagination information
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ——————————————— GET PET DETAILS ———————————————
const getPetDetails = async (id) => {
  const pet = await prisma.pet.findUnique({
    where: { petID: id },
    select: {
      petID: true,
      petName: true,
      petAge: true,
      petSex: true,
      petColor: true,
      petHeight: true,
      petWeight: true,
      petDesc: true,
      microchipID: true,
      adoptionStatus: true,
      compatibleWithChildren: true,
      compatibleWithPets: true,
      specialNeeds: true,
      breed: {
        select: {
          breedID: true,
          breedName: true,
          species: { select: { speciesName: true } },
        },
      },
      shelter: {
        select: { shelterID: true, shelterName: true, shelterAddress: true },
      },
    },
  });

  // If the pet does not exist, throw an error
  if (!pet) {
    const err = new Error(`No pet exists with ID ${id}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  // Return the pet details
  return {
    petID: pet.petID,
    petName: pet.petName,
    petAge: pet.petAge,
    petSex: pet.petSex,
    petColor: pet.petColor,
    petHeight: pet.petHeight,
    petWeight: pet.petWeight,
    petDesc: pet.petDesc,
    breed: {
      breedID: pet.breed.breedID,
      breedName: pet.breed.breedName,
      speciesName: pet.breed.species.speciesName,
    },
    shelter: {
      shelterID: pet.shelter.shelterID,
      shelterName: pet.shelter.shelterName,
      shelterAddress: pet.shelter.shelterAddress,
    },
    compatibleWithChildren: pet.compatibleWithChildren,
    compatibleWithPets: pet.compatibleWithPets,
    specialNeeds: pet.specialNeeds,
    adoptionStatus: pet.adoptionStatus,
    microchipID: pet.microchipID,
  };
};

module.exports = { getAvailablePets, getPetDetails };
