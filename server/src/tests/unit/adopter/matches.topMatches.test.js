// Mocked so this suite never touches a real database or the AI provider. The
// cache itself (staleness, recompute) is covered by matches.aiCache.test.js —
// this covers GET /adopters/me/matches on top of it: the no-quiz case, the
// read-time exclusions, the PetCard shape and the limit param.
jest.mock("../../../config/prisma", () => ({
  adopter: { findUnique: jest.fn() },
  pet: { findMany: jest.fn(), findFirst: jest.fn() },
  adopterMatch: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../../services/ai", () => ({
  ...jest.requireActual("../../../services/ai"),
  isAiConfigured: jest.fn(),
  generateStructured: jest.fn(),
}));
jest.mock("../../../services/storage", () => ({
  PET_IMAGES_BUCKET: "pet-images",
  toPublicFileUrl: jest.fn((bucket, value) =>
    value ? `https://cdn.test/${bucket}/${value}` : value,
  ),
}));

const prisma = require("../../../config/prisma");
const ai = require("../../../services/ai");
const { getTopMatches } = require("../../../services/adopter/matches.service");
const { getMyMatches } = require("../../../controllers/adopter/matches.controller");

const NOW = new Date(2026, 9, 5);
const COMPUTED_AT = new Date(2026, 9, 4);

const matchRow = (petID, totalScore, overrides = {}) => ({
  petID,
  ruleScore: totalScore,
  aiScore: 80,
  totalScore,
  reason: `Pet ${petID} suits your routine.`,
  computedAt: COMPUTED_AT,
  ...overrides,
});

const petCardRow = (petID) => ({
  petID,
  petName: `Pet ${petID}`,
  petDOB: new Date(2023, 0, 1),
  petPhoto: `seed/pet${petID}.webp`,
  petSex: "F",
  breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
});

// A warm cache: these rows, and no pet changed since they were computed.
const mockWarmCache = (rows) => {
  prisma.adopterMatch.findMany.mockResolvedValueOnce(rows);
  prisma.pet.findFirst.mockResolvedValueOnce(null);
};

beforeEach(() => {
  jest.clearAllMocks();
  ai.isAiConfigured.mockReturnValue(true);
  prisma.adopter.findUnique.mockResolvedValue({ quiz: { adopterID: 7 } });
});

describe("getTopMatches", () => {
  test("no quiz yet → quizComplete false and no matches, nothing computed", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce({ quiz: null });

    await expect(getTopMatches(7)).resolves.toEqual({ quizComplete: false, matches: [] });
    expect(prisma.adopterMatch.findMany).not.toHaveBeenCalled();
    expect(ai.generateStructured).not.toHaveBeenCalled();
  });

  test("unknown adopter → NOT_FOUND", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce(null);
    await expect(getTopMatches(7)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("warm cache → top 3 in the PetCard shape, best first, no AI call", async () => {
    mockWarmCache([matchRow(1, 60), matchRow(2, 90), matchRow(3, 75), matchRow(4, 70)]);
    prisma.pet.findMany.mockResolvedValueOnce([1, 2, 3, 4].map(petCardRow));

    const result = await getTopMatches(7, { now: NOW });

    expect(ai.generateStructured).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.quizComplete).toBe(true);
    expect(result.matches.map((m) => m.petID)).toEqual([2, 3, 4]);
    expect(result.matches[0]).toEqual({
      petID: 2,
      petName: "Pet 2",
      petAge: expect.any(String),
      petSex: "Female",
      petPhoto: "https://cdn.test/pet-images/seed/pet2.webp",
      breed: { breedName: "Beagle", speciesName: "Dog" },
      score: 90,
      reason: "Pet 2 suits your routine.",
      aiExplained: true,
    });
    expect(result.matches[0]).not.toHaveProperty("petDOB");
  });

  test("excludes unavailable pets and the adopter's own Pending/Accepted applications", async () => {
    mockWarmCache([matchRow(1, 90), matchRow(2, 80), matchRow(3, 70), matchRow(4, 60)]);
    // Pets 1 and 3 fail the filter, so the next best fill the top 3.
    prisma.pet.findMany.mockResolvedValueOnce([2, 4].map(petCardRow));

    const result = await getTopMatches(7, { now: NOW });

    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          petID: { in: [1, 2, 3, 4] },
          adoptionStatus: "available",
          adoptionApps: {
            none: { adopterID: 7, applicationStatus: { in: ["Pending", "Accepted"] } },
          },
        },
      }),
    );
    expect(result.matches.map((m) => m.petID)).toEqual([2, 4]);
  });

  test("rule-only rows → aiExplained false and no reason", async () => {
    mockWarmCache([matchRow(1, 65, { aiScore: null, reason: null })]);
    prisma.pet.findMany.mockResolvedValueOnce([petCardRow(1)]);

    const [match] = (await getTopMatches(7, { now: NOW })).matches;
    expect(match).toMatchObject({ score: 65, reason: null, aiExplained: false });
  });

  test("honours limit", async () => {
    mockWarmCache([matchRow(1, 90), matchRow(2, 80), matchRow(3, 70)]);
    prisma.pet.findMany.mockResolvedValueOnce([1, 2, 3].map(petCardRow));

    const result = await getTopMatches(7, { limit: 1, now: NOW });
    expect(result.matches.map((m) => m.petID)).toEqual([1]);
  });

  test("nothing shortlisted → empty list without a pet-card query", async () => {
    // Stale (empty) cache → recompute; no available pets → no rows, no AI.
    prisma.adopterMatch.findMany.mockResolvedValueOnce([]);
    prisma.adopter.findUnique.mockResolvedValueOnce({ quiz: { adopterID: 7 } });
    prisma.adopter.findUnique.mockResolvedValueOnce({
      preferredBreed: null,
      quiz: { answers: {} },
    });
    prisma.pet.findMany.mockResolvedValueOnce([]);
    prisma.$transaction.mockResolvedValueOnce([]);

    await expect(getTopMatches(7, { now: NOW })).resolves.toEqual({
      quizComplete: true,
      matches: [],
    });
    expect(ai.generateStructured).not.toHaveBeenCalled();
    expect(prisma.pet.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("getMyMatches limit param", () => {
  const run = async (query) => {
    const req = { user: { userID: 7 }, query };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await getMyMatches(req, res, next);
    return { res, next };
  };

  test.each(["0", "21", "2.5", "abc", ""])("limit=%p → 400", async (limit) => {
    const { next } = await run({ limit });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "BAD_REQUEST" }));
    expect(prisma.adopter.findUnique).not.toHaveBeenCalled();
  });

  test("no quiz → 200 with quizComplete false", async () => {
    prisma.adopter.findUnique.mockResolvedValueOnce({ quiz: null });
    const { res, next } = await run({});
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { quizComplete: false, matches: [] } }),
    );
  });
});
