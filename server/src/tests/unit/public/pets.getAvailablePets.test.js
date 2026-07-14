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

// Minimal shape matching pets.service.js's `select` on prisma.pet.findMany.
const buildPet = (overrides = {}) => ({
  petID: 1,
  petName: "Buddy",
  petDOB: new Date(2020, 0, 1),
  petPhoto: "buddy.jpg",
  petSex: "M",
  breed: { breedName: "Labrador", species: { speciesName: "Dog" } },
  ...overrides,
});

const mockPetsResult = (pets, total) => {
  prisma.pet.findMany.mockResolvedValueOnce(pets);
  prisma.pet.count.mockResolvedValueOnce(total ?? pets.length);
};

describe("GET /api/v1/pets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ————————————————————————————— NO FILTERS —————————————————————————————
  describe("no filters", () => {
    test("returns paginated available pets with default page/limit", async () => {
      mockPetsResult([buildPet()], 1);

      const res = await request(app).get("/api/v1/pets");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available" },
          skip: 0,
          take: 20,
        }),
      );
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    // Only adoptionStatus='available' pets are ever returned — the filter
    // is hardcoded in the service, not derived from any client-supplied
    // query param, so there's no way for a caller to override it.
    test("adoptionStatus is always 'available', regardless of unrelated query params", async () => {
      mockPetsResult([], 0);

      await request(app)
        .get("/api/v1/pets")
        .query({ adoptionStatus: "pending" });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available" },
        }),
      );
    });
  });

  // ———————————————————————————— SPECIES FILTER ————————————————————————————
  describe("species filter", () => {
    test("single value → exact match, not wrapped in `in`", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets").query({ species: 3 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adoptionStatus: "available",
            breed: { species: { speciesID: 3 } },
          },
        }),
      );
    });

    test("multiple values → OR'd via `in`", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets?species=3&species=5");

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adoptionStatus: "available",
            breed: { species: { speciesID: { in: [3, 5] } } },
          },
        }),
      );
    });

    test("non-integer value → 400 BAD_REQUEST, query never runs", async () => {
      const res = await request(app)
        .get("/api/v1/pets")
        .query({ species: "abc" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— BREED FILTER —————————————————————————————
  describe("breed filter (open-set, unvalidated)", () => {
    test("nonsense value returns an empty array, not an error", async () => {
      mockPetsResult([], 0);

      const res = await request(app)
        .get("/api/v1/pets")
        .query({ breed: "Zorblaxian" });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adoptionStatus: "available",
            breed: { breedName: "Zorblaxian" },
          },
        }),
      );
    });

    test("multiple values → OR'd via `in`", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets?breed=Bulldog&breed=Poodle");

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adoptionStatus: "available",
            breed: { breedName: { in: ["Bulldog", "Poodle"] } },
          },
        }),
      );
    });

    test("species + breed together merge into the same breed.where, neither overwriting the other", async () => {
      mockPetsResult([], 0);

      await request(app)
        .get("/api/v1/pets")
        .query({ breed: "Bulldog", species: 2 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            adoptionStatus: "available",
            breed: { breedName: "Bulldog", species: { speciesID: 2 } },
          },
        }),
      );
    });
  });

  // ————————————————————————————— SIZE FILTER —————————————————————————————
  describe("size filter", () => {
    test("valid enum value → exact match", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets").query({ size: "Small" });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available", petSize: "Small" },
        }),
      );
    });

    test("invalid value → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/pets")
        .query({ size: "Huge" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });
  });

  // ——————————————————————— AGE FILTERS (minAge/maxAge, in months) ———————————————————————
  // No fake timers here — Date is only compared at day-level granularity, so
  // capturing `new Date()` in the test immediately before the request and
  // replicating the service's own month-arithmetic is deterministic enough
  // in practice, without the risk of fake timers stalling supertest's real
  // async request/response cycle.
  describe("age filters", () => {
    const monthsAgo = (months, today) =>
      new Date(today.getFullYear(), today.getMonth() - months, today.getDate());

    test("minAge only → petDOB.lte at the exact month boundary", async () => {
      mockPetsResult([], 0);
      const today = new Date();

      await request(app).get("/api/v1/pets").query({ minAge: 6 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            petDOB: { lte: monthsAgo(6, today) },
          }),
        }),
      );
    });

    test("maxAge only → petDOB.gt at an asymmetric +1-month boundary", async () => {
      mockPetsResult([], 0);
      const today = new Date();

      await request(app).get("/api/v1/pets").query({ maxAge: 6 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            petDOB: { gt: monthsAgo(7, today) },
          }),
        }),
      );
    });

    test("minAge and maxAge together → both bounds set on the same petDOB filter", async () => {
      mockPetsResult([], 0);
      const today = new Date();

      await request(app).get("/api/v1/pets").query({ minAge: 2, maxAge: 6 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            petDOB: { lte: monthsAgo(2, today), gt: monthsAgo(7, today) },
          }),
        }),
      );
    });

    test("minAge > maxAge → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/pets")
        .query({ minAge: 10, maxAge: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });

    test("non-integer minAge/maxAge → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/pets")
        .query({ minAge: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });
  });

  // ———————————————————————————— SHELTERID FILTER ————————————————————————————
  describe("shelterID filter", () => {
    test("single valid value → exact match", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets").query({ shelterID: 2 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available", shelterID: 2 },
        }),
      );
    });

    test("multiple valid values → OR'd via `in`", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets?shelterID=2&shelterID=4");

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available", shelterID: { in: [2, 4] } },
        }),
      );
    });

    test("non-numeric value → coerced to -1, returns empty without erroring", async () => {
      mockPetsResult([], 0);

      const res = await request(app)
        .get("/api/v1/pets")
        .query({ shelterID: "abc" });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available", shelterID: -1 },
        }),
      );
    });

    test("mixed valid + non-numeric values → the non-numeric one coerces to -1 inside the `in`", async () => {
      mockPetsResult([], 0);

      await request(app).get("/api/v1/pets?shelterID=2&shelterID=xyz");

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adoptionStatus: "available", shelterID: { in: [2, -1] } },
        }),
      );
    });
  });

  // ————————————————————————————— PAGINATION —————————————————————————————
  describe("pagination", () => {
    test("page/limit → correct skip/take and totalPages math", async () => {
      mockPetsResult(
        new Array(10).fill(null).map((_, i) => buildPet({ petID: i + 1 })),
        45,
      );

      const res = await request(app)
        .get("/api/v1/pets")
        .query({ page: 3, limit: 10 });

      expect(prisma.pet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(res.body.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 45,
        totalPages: 5,
      });
    });

    test("zero results → totalPages is 0, not NaN or negative", async () => {
      mockPetsResult([], 0);

      const res = await request(app).get("/api/v1/pets");

      expect(res.body.pagination.totalPages).toBe(0);
    });

    test("limit 0 → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets").query({ limit: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });

    test("limit 101 → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets").query({ limit: 101 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });

    test("limit 1 and limit 100 (boundary values) are both valid", async () => {
      mockPetsResult([], 0);
      const res1 = await request(app).get("/api/v1/pets").query({ limit: 1 });
      expect(res1.status).toBe(200);

      mockPetsResult([], 0);
      const res2 = await request(app).get("/api/v1/pets").query({ limit: 100 });
      expect(res2.status).toBe(200);
    });

    test("page 0 → 400 BAD_REQUEST", async () => {
      const res = await request(app).get("/api/v1/pets").query({ page: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— RESPONSE SHAPE —————————————————————————————
  describe("response shape", () => {
    test("petAge is a formatted string computed from petDOB — petDOB itself is never returned", async () => {
      // Old enough that formatAgeFromDOBYears takes the "years" branch,
      // regardless of exactly which day the test happens to run on.
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      mockPetsResult([buildPet({ petDOB: threeYearsAgo })], 1);

      const res = await request(app).get("/api/v1/pets");

      const pet = res.body.data[0];
      expect(typeof pet.petAge).toBe("string");
      expect(pet.petAge).toMatch(/^~\d+ yrs?$/);
      expect(pet).not.toHaveProperty("petDOB");
    });

    test("each pet includes petID, petName, petSex, petPhoto, and breed/species names", async () => {
      mockPetsResult(
        [
          buildPet({
            petID: 7,
            petName: "Mochi",
            petSex: "F",
            petPhoto: "mochi.jpg",
            breed: { breedName: "Poodle", species: { speciesName: "Dog" } },
          }),
        ],
        1,
      );

      const res = await request(app).get("/api/v1/pets");

      expect(res.body.data[0]).toMatchObject({
        petID: 7,
        petName: "Mochi",
        petSex: "Female",
        petPhoto: "mochi.jpg",
        breed: { breedName: "Poodle", speciesName: "Dog" },
      });
    });
  });
});
