const request = require("supertest");

// Mocked so this suite never touches a real database — breeds.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  breed: {
    findMany: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

describe("GET /api/v1/breeds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ————————————————————————————— NO SPECIESID —————————————————————————————
  test("no speciesID → returns an empty array without querying the DB at all", async () => {
    const res = await request(app).get("/api/v1/breeds");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    // The controller short-circuits before calling the service in this
    // case — worth locking down since it's a deliberate DB-avoidance
    // optimization, not just an incidental empty result.
    expect(prisma.breed.findMany).not.toHaveBeenCalled();
  });

  // ————————————————————————————— SPECIESID FILTER —————————————————————————————
  describe("speciesID filter", () => {
    test("single speciesID → correct breeds for that species, still wrapped in `in`", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([
        { breedID: 1, breedName: "Labrador", species: { speciesName: "Dog" } },
      ]);

      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 2 });

      expect(res.status).toBe(200);
      // Unlike pets.service.js's matchFilter, breeds.service.js always uses
      // `in`, even for a single value — no single-value shortcut here.
      expect(prisma.breed.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { speciesID: { in: [2] } } }),
      );
      expect(res.body.data).toEqual([
        { breedID: 1, breedName: "Labrador", speciesName: "Dog" },
      ]);
    });

    test("multiple speciesID (repeatable param) → OR'd via `in`", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([]);

      await request(app).get("/api/v1/breeds?speciesID=2&speciesID=5");

      expect(prisma.breed.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { speciesID: { in: [2, 5] } } }),
      );
    });

    test("speciesID with no matching breeds → returns an empty array, not an error", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 999 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test("non-integer speciesID → 400 BAD_REQUEST, DB never queried", async () => {
      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: "abc" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.breed.findMany).not.toHaveBeenCalled();
    });

    test("zero or negative speciesID → 400 BAD_REQUEST", async () => {
      const zeroRes = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 0 });
      expect(zeroRes.status).toBe(400);
      expect(zeroRes.body.error.code).toBe("BAD_REQUEST");

      const negativeRes = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: -3 });
      expect(negativeRes.status).toBe(400);
      expect(negativeRes.body.error.code).toBe("BAD_REQUEST");

      expect(prisma.breed.findMany).not.toHaveBeenCalled();
    });

    test("one invalid value among several → 400 BAD_REQUEST, none of them run", async () => {
      const res = await request(app).get(
        "/api/v1/breeds?speciesID=2&speciesID=abc",
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.breed.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ORDERING —————————————————————————————
  // As with the other list endpoints, Prisma is mocked, so the only thing a
  // unit test can verify is that the service asks the DB to sort this way —
  // actual sort correctness is the database's job.
  test("orders by species name then breed name", async () => {
    prisma.breed.findMany.mockResolvedValueOnce([]);

    await request(app).get("/api/v1/breeds").query({ speciesID: 1 });

    expect(prisma.breed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ species: { speciesName: "asc" } }, { breedName: "asc" }],
      }),
    );
  });

  // ————————————————————————————— RESPONSE SHAPE —————————————————————————————
  describe("response shape", () => {
    test("breedID, breedName, and flattened speciesName only — no nested species object", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([
        { breedID: 4, breedName: "Poodle", species: { speciesName: "Dog" } },
      ]);

      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 1 });

      expect(res.body.data[0]).toEqual({
        breedID: 4,
        breedName: "Poodle",
        speciesName: "Dog",
      });
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ["breedID", "breedName", "speciesName"].sort(),
      );
    });

    test("response is a plain array, not wrapped in a pagination object", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([
        { breedID: 4, breedName: "Poodle", species: { speciesName: "Dog" } },
      ]);

      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 1 });

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeUndefined();
      expect(Object.keys(res.body).sort()).toEqual(
        ["success", "message", "data"].sort(),
      );
    });

    test("multiple breeds preserve the order returned by the DB", async () => {
      prisma.breed.findMany.mockResolvedValueOnce([
        { breedID: 1, breedName: "Bulldog", species: { speciesName: "Dog" } },
        { breedID: 2, breedName: "Poodle", species: { speciesName: "Dog" } },
      ]);

      const res = await request(app)
        .get("/api/v1/breeds")
        .query({ speciesID: 1 });

      expect(res.body.data.map((b) => b.breedName)).toEqual([
        "Bulldog",
        "Poodle",
      ]);
    });
  });
});
