const request = require("supertest");

// Mocked so this suite never touches a real database — pets.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  pet: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

// Minimal shape matching pets.service.js's `select` on prisma.pet.findMany
// for getFeaturedPets.
const buildPet = (overrides = {}) => ({
  petID: 1,
  petName: "Buddy",
  petDOB: new Date(2020, 0, 1),
  petPhoto: "buddy.jpg",
  petSex: "M",
  breed: { breedName: "Labrador", species: { speciesName: "Dog" } },
  ...overrides,
});

describe("GET /api/v1/pets/featured", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Since Prisma is mocked, the only way to actually verify "featured AND
  // available" as a unit test is to assert the exact `where` clause the
  // service builds — the mock returns whatever it's told to regardless of
  // flag values, so it can't demonstrate real DB-level filtering itself.
  test("queries with featuredFlag=true AND adoptionStatus='available'", async () => {
    prisma.pet.findMany.mockResolvedValueOnce([]);

    await request(app).get("/api/v1/pets/featured");

    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adoptionStatus: "available", featuredFlag: true },
      }),
    );
  });

  test("query params are ignored entirely — no pagination/filtering support on this endpoint", async () => {
    prisma.pet.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/api/v1/pets/featured")
      .query({ page: 2, limit: 5, species: 3 });

    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adoptionStatus: "available", featuredFlag: true },
      }),
    );
    expect(prisma.pet.count).not.toHaveBeenCalled();
  });

  test("response is a plain array, not wrapped in a pagination object", async () => {
    prisma.pet.findMany.mockResolvedValueOnce([buildPet()]);

    const res = await request(app).get("/api/v1/pets/featured");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(
      ["success", "message", "data"].sort(),
    );
  });

  test("zero featured pets → returns an empty array, not an error", async () => {
    prisma.pet.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/v1/pets/featured");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  describe("response shape matches /pets", () => {
    test("petAge is a formatted string (~N yr/mo), petSex is formatted, breed is flattened", async () => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      prisma.pet.findMany.mockResolvedValueOnce([
        buildPet({
          petID: 7,
          petName: "Mochi",
          petDOB: threeYearsAgo,
          petSex: "F",
          petPhoto: "mochi.jpg",
          breed: { breedName: "Poodle", species: { speciesName: "Dog" } },
        }),
      ]);

      const res = await request(app).get("/api/v1/pets/featured");

      const pet = res.body.data[0];
      expect(pet).toMatchObject({
        petID: 7,
        petName: "Mochi",
        petSex: "Female",
        petPhoto: "mochi.jpg",
        breed: { breedName: "Poodle", speciesName: "Dog" },
      });
      expect(typeof pet.petAge).toBe("string");
      expect(pet.petAge).toMatch(/^~\d+ yrs?$/);
    });

    test("petDOB is never leaked, and no stray fields beyond the /pets shape", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([buildPet()]);

      const res = await request(app).get("/api/v1/pets/featured");

      const pet = res.body.data[0];
      expect(pet).not.toHaveProperty("petDOB");
      expect(Object.keys(pet).sort()).toEqual(
        ["petID", "petName", "petAge", "petSex", "petPhoto", "breed"].sort(),
      );
    });

    test("multiple featured pets preserve order and each map independently", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([
        buildPet({ petID: 1, petName: "Buddy" }),
        buildPet({ petID: 2, petName: "Mochi" }),
        buildPet({ petID: 3, petName: "Rex" }),
      ]);

      const res = await request(app).get("/api/v1/pets/featured");

      expect(res.body.data.map((p) => p.petID)).toEqual([1, 2, 3]);
      expect(res.body.data.map((p) => p.petName)).toEqual([
        "Buddy",
        "Mochi",
        "Rex",
      ]);
    });
  });
});
