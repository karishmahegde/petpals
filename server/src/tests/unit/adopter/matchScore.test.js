// The rule-based scorer is pure — no mocks needed. A fixed `now` keeps the
// age bands deterministic.
const {
  ageBand,
  passesHardFilters,
  scorePet,
  shortlistPets,
} = require("../../../services/adopter/matchScore");
const { MATCH_WEIGHTS, SHORTLIST_SIZE } = require("../../../config/matchScoring");

const NOW = new Date(2026, 9, 5); // 5 Oct 2026, local time
const monthsBefore = (months) => new Date(2026, 9 - months, 5);

// An adopter with no preferences or facts given at all.
const blankAdopter = (overrides = {}) => ({
  numChildren: null,
  currentPets: 0,
  openToSpecialNeeds: false,
  preferredSize: null,
  preferredAgeRange: null,
  preferredBreedID: null,
  preferredSpeciesID: null,
  housingType: null,
  yardAvailable: false,
  petExperience: null,
  activityLevel: null,
  ...overrides,
});

// An available adult medium dog (species 1, breed 10) that suits anyone.
const pet = (overrides = {}) => ({
  petID: 1,
  breedID: 10,
  speciesID: 1,
  petDOB: monthsBefore(48),
  petSize: "Medium",
  intakeDate: new Date("2026-06-01"),
  adoptionStatus: "available",
  compatibleWithChildren: true,
  compatibleWithPets: true,
  specialNeeds: false,
  ...overrides,
});

describe("ageBand", () => {
  test.each([
    [0, "Young"],
    [23, "Young"],
    [24, "Adult"],
    [95, "Adult"],
    [96, "Old"],
  ])("%i months -> %s", (months, band) => {
    expect(ageBand(monthsBefore(months), NOW)).toBe(band);
  });

  test("a birthday later this month hasn't counted yet", () => {
    expect(ageBand(new Date(2024, 9, 6), NOW)).toBe("Young"); // 23 months, not 24
  });
});

describe("passesHardFilters", () => {
  test("a compatible available pet passes", () => {
    expect(passesHardFilters(blankAdopter(), pet())).toBe(true);
  });

  test.each(["incoming", "adopted", "fostered", "transferred", "deceased", null])(
    "%s pets are filtered out",
    (adoptionStatus) => {
      expect(passesHardFilters(blankAdopter(), pet({ adoptionStatus }))).toBe(false);
    },
  );

  test("children at home exclude pets not good with children", () => {
    const adopter = blankAdopter({ numChildren: 2 });
    expect(passesHardFilters(adopter, pet({ compatibleWithChildren: false }))).toBe(false);
    expect(passesHardFilters(adopter, pet({ compatibleWithChildren: true }))).toBe(true);
  });

  test("no children, or not stated, filters nothing", () => {
    const unfriendly = pet({ compatibleWithChildren: false });
    expect(passesHardFilters(blankAdopter({ numChildren: 0 }), unfriendly)).toBe(true);
    expect(passesHardFilters(blankAdopter({ numChildren: null }), unfriendly)).toBe(true);
  });

  test("current pets exclude pets not good with other pets", () => {
    const adopter = blankAdopter({ currentPets: 1 });
    expect(passesHardFilters(adopter, pet({ compatibleWithPets: false }))).toBe(false);
    expect(passesHardFilters(blankAdopter(), pet({ compatibleWithPets: false }))).toBe(true);
  });

  test("special-needs pets only for adopters open to them", () => {
    const special = pet({ specialNeeds: true });
    expect(passesHardFilters(blankAdopter(), special)).toBe(false);
    expect(passesHardFilters(blankAdopter({ openToSpecialNeeds: true }), special)).toBe(true);
  });
});

describe("scorePet", () => {
  test("weights add up to 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test("a perfect match scores 100", () => {
    const adopter = blankAdopter({
      preferredSize: "Medium",
      preferredAgeRange: "Adult",
      preferredBreedID: 10,
      preferredSpeciesID: 1,
      housingType: "House",
      yardAvailable: true,
      petExperience: "Some",
      activityLevel: "Medium",
    });
    const { score, breakdown } = scorePet(adopter, null, pet(), NOW);
    expect(score).toBe(100);
    expect(Object.values(breakdown).every((fit) => fit === 1)).toBe(true);
  });

  test("score is always a whole number from 0 to 100", () => {
    const adopter = blankAdopter({
      preferredSize: "Small",
      preferredAgeRange: "Old",
      preferredBreedID: 99,
      preferredSpeciesID: 2,
      housingType: "Apartment",
      petExperience: "No",
      activityLevel: "Sedentary",
    });
    const { score } = scorePet(adopter, null, pet({ petSize: "Large", petDOB: monthsBefore(6) }), NOW);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(30);
  });

  test("no preference counts as a full fit; unknown facts are neutral", () => {
    const { breakdown } = scorePet(blankAdopter(), null, pet({ petSize: "Large" }), NOW);
    expect(breakdown.size).toBe(1);
    expect(breakdown.age).toBe(1);
    expect(breakdown.breed).toBe(1);
    expect(breakdown.home).toBe(0.5);
    expect(breakdown.experience).toBe(0.5); // Large asks for some experience
    expect(breakdown.activity).toBe(0.5);
  });

  test.each([
    ["Medium", 1],
    ["Small", 0.5],
    ["Large", 0.5],
  ])("preferred Medium vs %s -> size fit %d", (petSize, fit) => {
    const { breakdown } = scorePet(blankAdopter({ preferredSize: "Medium" }), null, pet({ petSize }), NOW);
    expect(breakdown.size).toBe(fit);
  });

  test("opposite ends of the size scale don't fit", () => {
    const { breakdown } = scorePet(blankAdopter({ preferredSize: "Small" }), null, pet({ petSize: "Large" }), NOW);
    expect(breakdown.size).toBe(0);
  });

  test("age range is matched against the pet's band from petDOB", () => {
    const adopter = blankAdopter({ preferredAgeRange: "Young" });
    expect(scorePet(adopter, null, pet({ petDOB: monthsBefore(6) }), NOW).breakdown.age).toBe(1);
    expect(scorePet(adopter, null, pet({ petDOB: monthsBefore(48) }), NOW).breakdown.age).toBe(0.5);
    expect(scorePet(adopter, null, pet({ petDOB: monthsBefore(120) }), NOW).breakdown.age).toBe(0);
  });

  test("breed: preferred 1, same species 0.5, other species 0", () => {
    const adopter = blankAdopter({ preferredBreedID: 10, preferredSpeciesID: 1 });
    expect(scorePet(adopter, null, pet(), NOW).breakdown.breed).toBe(1);
    expect(scorePet(adopter, null, pet({ breedID: 11 }), NOW).breakdown.breed).toBe(0.5);
    expect(scorePet(adopter, null, pet({ breedID: 20, speciesID: 2 }), NOW).breakdown.breed).toBe(0);
  });

  test("a large pet suits a house with a yard over an apartment without one", () => {
    const large = pet({ petSize: "Large" });
    const house = scorePet(blankAdopter({ housingType: "House", yardAvailable: true }), null, large, NOW);
    const flat = scorePet(blankAdopter({ housingType: "Apartment" }), null, large, NOW);
    expect(house.breakdown.home).toBe(1);
    expect(flat.breakdown.home).toBeCloseTo(0.2);
  });

  test("small pets fit any home", () => {
    const { breakdown } = scorePet(blankAdopter({ housingType: "Apartment" }), null, pet({ petSize: "Small" }), NOW);
    expect(breakdown.home).toBe(1);
  });

  test("experience: a demanding pet needs an experienced adopter", () => {
    const demanding = pet({ petSize: "Large", petDOB: monthsBefore(6), specialNeeds: true });
    const novice = scorePet(blankAdopter({ petExperience: "No" }), null, demanding, NOW);
    const expert = scorePet(blankAdopter({ petExperience: "Very" }), null, demanding, NOW);
    expect(novice.breakdown.experience).toBe(0);
    expect(expert.breakdown.experience).toBe(1);
  });

  test("experience: an easy pet suits anyone", () => {
    const { breakdown } = scorePet(blankAdopter({ petExperience: "No" }), null, pet(), NOW);
    expect(breakdown.experience).toBe(1);
  });

  test("activity: an active adopter suits a young pet over an old one", () => {
    const adopter = blankAdopter({ activityLevel: "Active" });
    expect(scorePet(adopter, null, pet({ petDOB: monthsBefore(6) }), NOW).breakdown.activity).toBe(1);
    expect(scorePet(adopter, null, pet({ petDOB: monthsBefore(120) }), NOW).breakdown.activity).toBe(0);
  });

  test("activity: the quiz's exercise answer is averaged with the profile", () => {
    const young = pet({ petDOB: monthsBefore(6) });
    // Sedentary (0) + "over2h" (1) -> 0.5 against a young pet's 1.
    const { breakdown } = scorePet(
      blankAdopter({ activityLevel: "Sedentary" }),
      { exercise: "over2h" },
      young,
      NOW,
    );
    expect(breakdown.activity).toBe(0.5);
  });

  test("activity: the quiz alone is enough when the profile is blank", () => {
    const old = pet({ petDOB: monthsBefore(120) });
    const { breakdown } = scorePet(blankAdopter(), { exercise: "under30m" }, old, NOW);
    expect(breakdown.activity).toBe(1);
  });

  test("activity: an unknown quiz code is ignored", () => {
    const { breakdown } = scorePet(blankAdopter(), { exercise: "retired" }, pet(), NOW);
    expect(breakdown.activity).toBe(0.5);
  });
});

describe("shortlistPets", () => {
  const adopter = blankAdopter({ preferredSize: "Small", numChildren: 1 });

  test("drops filtered-out pets and ranks the rest best first", () => {
    const pets = [
      pet({ petID: 1, petSize: "Large" }),
      pet({ petID: 2, petSize: "Small" }),
      pet({ petID: 3, petSize: "Small", compatibleWithChildren: false }),
      pet({ petID: 4, petSize: "Medium" }),
      pet({ petID: 5, petSize: "Small", adoptionStatus: "adopted" }),
    ];
    const result = shortlistPets(adopter, null, pets, { now: NOW });
    expect(result.map((r) => r.pet.petID)).toEqual([2, 4, 1]);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].breakdown).toBeDefined();
  });

  test("ties go to the longest-waiting pet, then the lower petID", () => {
    const pets = [
      pet({ petID: 3, intakeDate: new Date("2026-05-01") }),
      pet({ petID: 2, intakeDate: new Date("2026-01-01") }),
      pet({ petID: 1, intakeDate: new Date("2026-05-01") }),
    ];
    const result = shortlistPets(adopter, null, pets, { now: NOW });
    expect(result.map((r) => r.pet.petID)).toEqual([2, 1, 3]);
  });

  test(`keeps the top ${SHORTLIST_SIZE} by default`, () => {
    const pets = Array.from({ length: SHORTLIST_SIZE + 5 }, (_, i) => pet({ petID: i + 1 }));
    expect(shortlistPets(adopter, null, pets, { now: NOW })).toHaveLength(SHORTLIST_SIZE);
  });

  test("respects a custom limit, and an empty list is fine", () => {
    expect(shortlistPets(adopter, null, [pet(), pet({ petID: 2 })], { now: NOW, limit: 1 })).toHaveLength(1);
    expect(shortlistPets(adopter, null, [], { now: NOW })).toEqual([]);
  });

  test("doesn't mutate the input", () => {
    const pets = [pet({ petID: 2, petSize: "Large" }), pet({ petID: 1, petSize: "Small" })];
    const before = JSON.stringify(pets);
    shortlistPets(adopter, null, pets, { now: NOW });
    expect(JSON.stringify(pets)).toBe(before);
  });
});
