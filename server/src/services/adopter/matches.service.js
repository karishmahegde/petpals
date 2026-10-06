const prisma = require("../../config/prisma");
const { shortlistPets } = require("./matchScore");

const notFound = (userID) => {
  const err = new Error(`No adopter exists with ID ${userID}`);
  err.code = "NOT_FOUND";
  return err;
};

// What the scorer reads from the adopter (see services/adopter/matchScore.js).
const ADOPTER_MATCH_SELECT = {
  numChildren: true,
  currentPets: true,
  openToSpecialNeeds: true,
  preferredSize: true,
  preferredAgeRange: true,
  preferredBreedID: true,
  housingType: true,
  yardAvailable: true,
  petExperience: true,
  activityLevel: true,
  preferredBreed: { select: { speciesID: true } },
  quiz: { select: { answers: true } },
};

// What the scorer reads from a pet, plus petName/petDesc for the AI step.
const PET_MATCH_SELECT = {
  petID: true,
  petName: true,
  petDesc: true,
  breedID: true,
  petDOB: true,
  petSize: true,
  intakeDate: true,
  adoptionStatus: true,
  compatibleWithChildren: true,
  compatibleWithPets: true,
  specialNeeds: true,
  breed: { select: { speciesID: true } },
};

// ——————————————— RULE SHORTLIST ———————————————
// The adopter's top available pets by rule score, best first. Each result is
// already a complete match on its own — aiScore null, totalScore = ruleScore —
// which is what the matcher keeps when AI isn't configured or fails; the AI
// step fills in aiScore and recombines.
const getRuleShortlist = async (adopterID, { now = new Date() } = {}) => {
  const adopter = await prisma.adopter.findUnique({
    where: { userID: adopterID },
    select: ADOPTER_MATCH_SELECT,
  });
  if (!adopter) {
    throw notFound(adopterID);
  }

  const pets = await prisma.pet.findMany({
    where: { adoptionStatus: "available" },
    select: PET_MATCH_SELECT,
  });

  const { preferredBreed, quiz, ...profile } = adopter;
  const shortlist = shortlistPets(
    { ...profile, preferredSpeciesID: preferredBreed?.speciesID ?? null },
    quiz?.answers ?? null,
    pets.map(({ breed, ...pet }) => ({ ...pet, speciesID: breed.speciesID })),
    { now },
  );

  return shortlist.map(({ pet, score, breakdown }) => ({
    petID: pet.petID,
    ruleScore: score,
    aiScore: null,
    totalScore: score,
    breakdown,
    pet,
  }));
};

module.exports = { getRuleShortlist };
