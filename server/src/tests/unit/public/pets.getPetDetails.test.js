const request = require("supertest");

// Mocked so this suite never touches a real database — pets.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  pet: {
    findUnique: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

// Minimal shape matching pets.service.js's `select` on prisma.pet.findUnique.
const buildPetRecord = (overrides = {}) => ({
  petID: 5,
  petName: "Buddy",
  petDOB: new Date(2020, 0, 1),
  petSex: "M",
  petPhoto: "buddy.jpg",
  petColor: "Golden",
  petHeight: 55,
  petWeight: 28.5,
  petDesc: "Friendly and energetic.",
  compatibleWithChildren: true,
  compatibleWithPets: false,
  specialNeeds: false,
  breed: {
    breedID: 3,
    breedName: "Labrador",
    species: { speciesName: "Dog" },
  },
  shelter: {
    shelterID: 1,
    shelterName: "PetPals Brooklyn",
    shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
  },
  ...overrides,
});

describe("GET /api/v1/pets/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ————————————————————————————— VALID ID —————————————————————————————
  test("valid existing petID → 200, full pet detail", async () => {
    prisma.pet.findUnique.mockResolvedValueOnce(buildPetRecord());

    const res = await request(app).get("/api/v1/pets/5");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.pet.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petID: 5 } }),
    );
    expect(res.body.data).toMatchObject({
      petID: 5,
      petName: "Buddy",
      petSex: "Male",
      petPhoto: "buddy.jpg",
      petColor: "Golden",
      petHeight: 55,
      petWeight: 28.5,
      petDesc: "Friendly and energetic.",
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
      breed: { breedID: 3, breedName: "Labrador", speciesName: "Dog" },
      shelter: {
        shelterID: 1,
        shelterName: "PetPals Brooklyn",
        shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
      },
    });
  });

  test("response only ever contains the mapped fields — no internal-only fields leak through", async () => {
    prisma.pet.findUnique.mockResolvedValueOnce(buildPetRecord());

    const res = await request(app).get("/api/v1/pets/5");

    expect(Object.keys(res.body.data).sort()).toEqual(
      [
        "petID",
        "petName",
        "petAge",
        "petSex",
        "petPhoto",
        "petColor",
        "petHeight",
        "petWeight",
        "petDesc",
        "breed",
        "shelter",
        "compatibleWithChildren",
        "compatibleWithPets",
        "specialNeeds",
      ].sort(),
    );
  });

  // ————————————————————————————— INVALID ID FORMAT —————————————————————————————
  describe("invalid id format", () => {
    test("non-integer id (letters) → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets/abc");

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("non-integer id (decimal) → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets/3.5");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("zero → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets/0");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });

    test("negative id → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets/-5");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— NOT FOUND —————————————————————————————
  test("valid but non-existent petID → 404 NOT_FOUND", async () => {
    prisma.pet.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get("/api/v1/pets/999");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(res.body.message).toMatch(/999/);
  });

  // ————————————————————————————— RESPONSE SHAPE —————————————————————————————
  describe("response shape", () => {
    // No fake timers — see pets.getAvailablePets.test.js for why capturing
    // a DOB relative to "now" at request time is deterministic enough here.
    test("petAge is a formatted string (years branch) — petDOB itself is never returned", async () => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      prisma.pet.findUnique.mockResolvedValueOnce(
        buildPetRecord({ petDOB: threeYearsAgo }),
      );

      const res = await request(app).get("/api/v1/pets/5");

      expect(typeof res.body.data.petAge).toBe("string");
      expect(res.body.data.petAge).toMatch(/^\d+ yr$/);
      expect(res.body.data).not.toHaveProperty("petDOB");
    });

    test("petAge is a formatted string (months branch) for a pet under a year old", async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      prisma.pet.findUnique.mockResolvedValueOnce(
        buildPetRecord({ petDOB: threeMonthsAgo }),
      );

      const res = await request(app).get("/api/v1/pets/5");

      expect(res.body.data.petAge).toMatch(/^\d+ mo$/);
    });

    test("petSex 'F' formats to 'Female'", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(
        buildPetRecord({ petSex: "F" }),
      );

      const res = await request(app).get("/api/v1/pets/5");

      expect(res.body.data.petSex).toBe("Female");
    });

    test("unrecognized petSex value falls back to 'Unknown'", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(
        buildPetRecord({ petSex: "X" }),
      );

      const res = await request(app).get("/api/v1/pets/5");

      expect(res.body.data.petSex).toBe("Unknown");
    });

    test("boolean compatibility fields pass through unchanged, not stringified", async () => {
      prisma.pet.findUnique.mockResolvedValueOnce(
        buildPetRecord({
          compatibleWithChildren: true,
          compatibleWithPets: true,
          specialNeeds: true,
        }),
      );

      const res = await request(app).get("/api/v1/pets/5");

      expect(res.body.data.compatibleWithChildren).toBe(true);
      expect(res.body.data.compatibleWithPets).toBe(true);
      expect(res.body.data.specialNeeds).toBe(true);
    });
  });
});
