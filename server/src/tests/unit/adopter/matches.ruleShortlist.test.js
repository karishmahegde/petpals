// Mocked so this suite never touches a real database. The scorer itself is
// covered by matchScore.test.js — this checks the loading and the result shape.
jest.mock("../../../config/prisma", () => ({
  adopter: { findUnique: jest.fn() },
  pet: { findMany: jest.fn() },
}));

const prisma = require("../../../config/prisma");
const { getRuleShortlist } = require("../../../services/adopter/matches.service");

const NOW = new Date(2026, 9, 5);

const adopterRow = (overrides = {}) => ({
  numChildren: 0,
  currentPets: 0,
  openToSpecialNeeds: false,
  preferredSize: "Small",
  preferredAgeRange: null,
  preferredBreedID: 10,
  housingType: "Apartment",
  yardAvailable: false,
  petExperience: "Some",
  activityLevel: "Medium",
  preferredBreed: { speciesID: 1 },
  quiz: { answers: { exercise: "halfToOneH" } },
  ...overrides,
});

const petRow = (overrides = {}) => ({
  petID: 1,
  petName: "Biscuit",
  petDesc: "Loves naps.",
  breedID: 10,
  petDOB: new Date(2022, 9, 5),
  petSize: "Small",
  intakeDate: new Date("2026-06-01"),
  adoptionStatus: "available",
  compatibleWithChildren: true,
  compatibleWithPets: true,
  specialNeeds: false,
  breed: { speciesID: 1 },
  ...overrides,
});

describe("getRuleShortlist", () => {
  beforeEach(() => jest.clearAllMocks());

  test("loads available pets only and returns rule-only matches, best first", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce(adopterRow());
    prisma.pet.findMany.mockResolvedValueOnce([
      petRow({ petID: 2, breedID: 30, petSize: "Large", breed: { speciesID: 2 } }),
      petRow({ petID: 1 }),
    ]);

    const result = await getRuleShortlist(7, { now: NOW });

    expect(prisma.adopter.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userID: 7 } }),
    );
    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { adoptionStatus: "available" } }),
    );
    expect(result.map((m) => m.petID)).toEqual([1, 2]);

    const [top] = result;
    expect(top).toEqual(
      expect.objectContaining({ petID: 1, aiScore: null, totalScore: top.ruleScore }),
    );
    // Quiz "halfToOneH" (1/3) averaged with Medium (0.5) sits just under an
    // adult pet's energy (0.5) — everything else is a full fit.
    expect(top.ruleScore).toBe(99);
    expect(top.ruleScore).toBeGreaterThan(result[1].ruleScore);
    expect(top.breakdown.breed).toBe(1);
    // The pet goes on to the AI step with its name and description, species flattened.
    expect(top.pet).toEqual(expect.objectContaining({ petName: "Biscuit", petDesc: "Loves naps.", speciesID: 1 }));
    expect(top.pet.breed).toBeUndefined();
  });

  test("works without a quiz or a preferred breed", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce(
      adopterRow({ quiz: null, preferredBreed: null, preferredBreedID: null }),
    );
    prisma.pet.findMany.mockResolvedValueOnce([petRow()]);

    const [match] = await getRuleShortlist(7, { now: NOW });

    expect(match.breakdown.breed).toBe(1);
    expect(match.breakdown.activity).toBe(1); // Medium vs an adult pet
  });

  test("applies the hard filters", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce(adopterRow({ currentPets: 2 }));
    prisma.pet.findMany.mockResolvedValueOnce([petRow({ compatibleWithPets: false })]);

    expect(await getRuleShortlist(7, { now: NOW })).toEqual([]);
  });

  test("404 for an unknown adopter", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce(null);

    await expect(getRuleShortlist(7)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.pet.findMany).not.toHaveBeenCalled();
  });
});
