// The rule-based compatibility score — the deterministic first pass of the
// matcher (services/adopter/matchScore.js). Every knob lives here so tuning
// never means touching the scorer.
//
// Each factor yields a fit from 0 to 1; the score is the weighted sum, so the
// weights add up to 100 and the score reads as 0–100.

const MATCH_WEIGHTS = {
  size: 20, // preferredSize vs petSize
  age: 15, // preferredAgeRange vs the pet's age band (from petDOB)
  breed: 15, // preferredBreedID vs breed (same species = partial)
  home: 20, // housing type + yard vs petSize
  experience: 15, // petExperience vs how demanding the pet is
  activity: 15, // activityLevel + quiz exercise vs the pet's energy (age band)
};

// A pet's age band, matching the adopter's preferredAgeRange values.
// Young under YOUNG_UNDER months, Old from OLD_FROM months, Adult between.
const AGE_BAND_MONTHS = { YOUNG_UNDER: 24, OLD_FROM: 96 };

// How well a home suits each pet size — HOME_FIT[housingType][petSize], with
// the yard bonus added on top (capped at 1). Small pets fit anywhere; a large
// pet in an apartment with no yard is the poor fit.
const HOME_FIT = {
  House: { Small: 1, Medium: 0.9, Large: 0.6 },
  Apartment: { Small: 1, Medium: 0.6, Large: 0.2 },
  Other: { Small: 1, Medium: 0.7, Large: 0.4 },
};
const YARD_BONUS = { Small: 0, Medium: 0.2, Large: 0.4 };

// How much handling experience a pet asks for, 0 (none) to 1 (a lot) — the
// sum of whichever apply, capped at 1.
const PET_DEMAND = { specialNeeds: 0.4, Large: 0.3, Young: 0.3 };

// The adopter's experience on the same 0–1 scale.
const EXPERIENCE_LEVEL = { No: 0, Little: 1 / 3, Some: 2 / 3, Very: 1 };

// Energy on a 0–1 scale: the adopter's from their profile and the quiz's
// exercise answer (averaged), the pet's from its age band.
const ACTIVITY_LEVEL = { Sedentary: 0, Medium: 0.5, Active: 1 };
const AGE_BAND_ENERGY = { Young: 1, Adult: 0.5, Old: 0 };

// The fit used when a factor can't be judged (the adopter left the field
// blank) — neutral, so missing data neither helps nor sinks a pet.
const UNKNOWN_FIT = 0.5;

// How many top-scoring pets go on to the AI step.
const SHORTLIST_SIZE = 20;

module.exports = {
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
};
