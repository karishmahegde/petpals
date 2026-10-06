// The rule-based compatibility scorer — pure functions, no Prisma, no AI. It
// stands on its own (the matcher's whole result when AI isn't configured) and
// shortlists the pets the AI step then reads. Weights and tables live in
// config/matchScoring.js.
//
// `adopter` is the Adopter row's matching fields plus `preferredSpeciesID`
// (the preferred breed's species); `answers` is the saved quiz answers or
// null; each pet carries `speciesID` (its breed's species).

const {
  MATCH_WEIGHTS,
  AGE_BAND_MONTHS,
  HOME_FIT,
  YARD_BONUS,
  PET_DEMAND,
  EXPERIENCE_LEVEL,
  ACTIVITY_LEVEL,
  AGE_BAND_ENERGY,
  UNKNOWN_FIT,
  SHORTLIST_SIZE,
} = require("../../config/matchScoring");
const { MATCH_QUIZ_QUESTIONS } = require("../../config/matchQuiz");

const SIZES = ["Small", "Medium", "Large"];
const AGE_BANDS = ["Young", "Adult", "Old"];

// Whole months between petDOB and `now` (same counting as the catalog's age).
const ageInMonths = (dob, now) => {
  const birth = new Date(dob);
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
};

const ageBand = (dob, now) => {
  const months = ageInMonths(dob, now);
  if (months < AGE_BAND_MONTHS.YOUNG_UNDER) return "Young";
  if (months >= AGE_BAND_MONTHS.OLD_FROM) return "Old";
  return "Adult";
};

// A quiz answer's position on its question's trait — first option 1, last 0
// (the options are ordered most → least, see config/matchQuiz.js). null when
// unanswered or no longer a known option.
const quizPosition = (answers, questionId) => {
  const question = MATCH_QUIZ_QUESTIONS.find((q) => q.id === questionId);
  const index = question?.options.findIndex((o) => o.code === answers?.[questionId]) ?? -1;
  if (index < 0) return null;
  return 1 - index / (question.options.length - 1);
};

// Exact 1, one step apart 0.5, further 0. No preference — anything fits.
const orderedFit = (order, preferred, actual) => {
  if (!preferred) return 1;
  if (!actual) return UNKNOWN_FIT;
  const gap = Math.abs(order.indexOf(preferred) - order.indexOf(actual));
  return Math.max(0, 1 - gap * 0.5);
};

// ——————————————— HARD FILTERS ———————————————
// A pet that fails any of these is never scored or shown. Only facts the
// adopter has given count against a pet — a blank numChildren filters nothing.
const passesHardFilters = (adopter, pet) => {
  if (pet.adoptionStatus !== "available") return false;
  if (adopter.numChildren > 0 && !pet.compatibleWithChildren) return false;
  if (adopter.currentPets > 0 && !pet.compatibleWithPets) return false;
  if (pet.specialNeeds && !adopter.openToSpecialNeeds) return false;
  return true;
};

// ——————————————— FACTORS (each 0–1) ———————————————
const sizeFit = (adopter, pet) => orderedFit(SIZES, adopter.preferredSize, pet.petSize);

const ageFit = (adopter, pet, now) =>
  orderedFit(AGE_BANDS, adopter.preferredAgeRange, ageBand(pet.petDOB, now));

// Preferred breed 1, another breed of the same species 0.5, else 0.
const breedFit = (adopter, pet) => {
  if (!adopter.preferredBreedID) return 1;
  if (pet.breedID === adopter.preferredBreedID) return 1;
  return pet.speciesID === adopter.preferredSpeciesID ? 0.5 : 0;
};

const homeFit = (adopter, pet) => {
  if (!adopter.housingType || !pet.petSize) return UNKNOWN_FIT;
  const base = HOME_FIT[adopter.housingType][pet.petSize];
  const yard = adopter.yardAvailable ? YARD_BONUS[pet.petSize] : 0;
  return Math.min(1, base + yard);
};

// Full marks when the adopter's experience covers what the pet asks for;
// falls off by the shortfall.
const experienceFit = (adopter, pet, now) => {
  const demand = Math.min(
    1,
    (pet.specialNeeds ? PET_DEMAND.specialNeeds : 0) +
      (pet.petSize === "Large" ? PET_DEMAND.Large : 0) +
      (ageBand(pet.petDOB, now) === "Young" ? PET_DEMAND.Young : 0),
  );
  if (demand === 0) return 1;
  if (!adopter.petExperience) return UNKNOWN_FIT;
  return 1 - Math.max(0, demand - EXPERIENCE_LEVEL[adopter.petExperience]);
};

// The adopter's energy is the average of whichever of profile activityLevel
// and the quiz's exercise answer they've given.
const activityFit = (adopter, answers, pet, now) => {
  const signals = [ACTIVITY_LEVEL[adopter.activityLevel], quizPosition(answers, "exercise")].filter(
    (value) => value !== undefined && value !== null,
  );
  if (signals.length === 0) return UNKNOWN_FIT;
  const adopterEnergy = signals.reduce((sum, value) => sum + value, 0) / signals.length;
  return 1 - Math.abs(adopterEnergy - AGE_BAND_ENERGY[ageBand(pet.petDOB, now)]);
};

// ——————————————— SCORE ———————————————
// { score 0–100, breakdown: { factor: fit 0–1 } } — the breakdown is kept for
// the AI prompt and for debugging a surprising score.
const scorePet = (adopter, answers, pet, now = new Date()) => {
  const breakdown = {
    size: sizeFit(adopter, pet),
    age: ageFit(adopter, pet, now),
    breed: breedFit(adopter, pet),
    home: homeFit(adopter, pet),
    experience: experienceFit(adopter, pet, now),
    activity: activityFit(adopter, answers, pet, now),
  };
  const score = Object.entries(MATCH_WEIGHTS).reduce(
    (sum, [factor, weight]) => sum + weight * breakdown[factor],
    0,
  );
  return { score: Math.round(score), breakdown };
};

// ——————————————— SHORTLIST ———————————————
// Hard-filters, scores and ranks `pets`, best first; ties go to the pet
// that's waited longest (earliest intakeDate), then the lower petID, so the
// order is stable. Returns [{ pet, score, breakdown }], at most `limit`.
const shortlistPets = (adopter, answers, pets, { now = new Date(), limit = SHORTLIST_SIZE } = {}) =>
  pets
    .filter((pet) => passesHardFilters(adopter, pet))
    .map((pet) => ({ pet, ...scorePet(adopter, answers, pet, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(a.pet.intakeDate) - new Date(b.pet.intakeDate) ||
        a.pet.petID - b.pet.petID,
    )
    .slice(0, limit);

module.exports = { ageBand, passesHardFilters, scorePet, shortlistPets };
