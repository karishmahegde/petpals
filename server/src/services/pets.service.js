const prisma = require("../config/prisma");

// Normalizes a filter value coming from req.query to array form: undefined -> [],
// a single value -> [value], an already-repeated query param -> passed through as-is.
const toArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

// One value -> exact match. Multiple values -> Prisma `in`. Empty -> no filter (caller skips it).
const matchFilter = (values) =>
  values.length === 1 ? values[0] : { in: values };

// Returns a Date exactly `months` months before today — used to convert a
// months-based age filter into a DOB boundary comparison.
const monthsAgo = (months) => {
  const today = new Date();
  return new Date(
    today.getFullYear(),
    today.getMonth() - months,
    today.getDate(),
  );
};

// minAge/maxAge are in MONTHS. Since age increases as DOB gets further in the
// past, the comparison direction is inverted relative to a normal age filter:
//   minAge (at least N months old) -> petDOB must be ON OR BEFORE (today - N months)
//   maxAge (at most N months old)  -> petDOB must be ON OR AFTER  (today - N months)
const buildAgeFilter = (minAge, maxAge) => {
  const dobFilter = {};
  if (minAge !== undefined) {
    dobFilter.lte = monthsAgo(Number(minAge));
  }
  if (maxAge !== undefined) {
    const today = new Date();
    const cutoff = new Date(
      today.getFullYear(),
      today.getMonth() - (Number(maxAge) + 1),
      today.getDate(),
    );
    dobFilter.gt = cutoff; // strict greater-than, not gte
  }
  return Object.keys(dobFilter).length > 0 ? dobFilter : undefined;
};

// Computes a pet's current age from DOB, formatted for display (e.g. "6 yr, 5 mo").
// Used only for the API response — never for filtering, which operates on raw
// petDOB date comparisons in buildAgeFilter and is entirely unaffected by this.
const formatAgeFromDOB = (dob) => {
  const today = new Date();
  const dobDate = new Date(dob);
  let totalMonths =
    (today.getFullYear() - dobDate.getFullYear()) * 12 +
    (today.getMonth() - dobDate.getMonth());
  if (today.getDate() < dobDate.getDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months} mo`;
  return `${years} yr`;
};

const formatAgeFromDOBYears = (dob) => {
  const today = new Date();
  const dobDate = new Date(dob);
  let totalMonths =
    (today.getFullYear() - dobDate.getFullYear()) * 12 +
    (today.getMonth() - dobDate.getMonth());
  if (today.getDate() < dobDate.getDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const unitYr = years > 1 ? "yrs" : "yr";
  const unitMo = "mo";

  if (years === 0) return `~${months} ${unitMo}`;
  return `~${years} ${unitYr}`;
};

const formatSex = (petSex) => {
  console.log("petSex");
  console.log(petSex);
  console.log(JSON.stringify(petSex));
  if (petSex === "M") return "male";
  if (petSex === "F") return "female";
  return "Unknown";
};

// ——————————————— GET AVAILABLE PETS ———————————————
const getAvailablePets = async (filters = {}, pagination = {}) => {
  const { species, breed, size, minAge, maxAge, shelterID } = filters;
  const { page = 1, limit = 20 } = pagination;

  const speciesValues = toArray(species);
  const breedValues = toArray(breed);
  const sizeValues = toArray(size);
  const shelterIDValues = toArray(shelterID);

  const where = { adoptionStatus: "available" };

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

  const ageFilter = buildAgeFilter(minAge, maxAge);
  if (ageFilter) {
    where.petDOB = ageFilter;
  }

  const skip = (page - 1) * limit;

  const [pets, total] = await Promise.all([
    prisma.pet.findMany({
      where,
      skip,
      take: limit,
      select: {
        petID: true,
        petName: true,
        petDOB: true, // selected for ageMonths calculation only, not returned
        petPhoto: true,
        petSex: true,
        breed: {
          select: {
            breedName: true,
            species: { select: { speciesName: true } },
          },
        },
      },
    }),
    prisma.pet.count({ where }),
  ]);

  const data = pets.map((pet) => ({
    petID: pet.petID,
    petName: pet.petName,
    petAge: formatAgeFromDOBYears(pet.petDOB),
    petSex: formatSex(pet.petSex),
    petPhoto: pet.petPhoto,
    breed: {
      breedName: pet.breed.breedName,
      speciesName: pet.breed.species.speciesName,
    },
  }));

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
      petDOB: true, // selected for ageMonths calculation only, not returned
      petSex: true,
      petColor: true,
      petHeight: true,
      petWeight: true,
      petDesc: true,
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

  if (!pet) {
    const err = new Error(`No pet exists with ID ${id}`);
    err.code = "NOT_FOUND";
    throw err;
  }

  return {
    petID: pet.petID,
    petName: pet.petName,
    petAge: formatAgeFromDOB(pet.petDOB),
    petSex: formatSex(pet.petSex),
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
  };
};

module.exports = { getAvailablePets, getPetDetails };
