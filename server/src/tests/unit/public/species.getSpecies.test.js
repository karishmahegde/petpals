const request = require("supertest");

// Mocked so this suite never touches a real database — species.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  species: {
    findMany: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

describe("GET /api/v1/species", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Since Prisma is mocked, the only way to actually verify "ordered
  // alphabetically" as a unit test is to assert the exact `orderBy` clause
  // the service asks the DB for — real sort-order correctness is the
  // database's job, which an integration test against a real DB would cover.
  test("queries all species with orderBy speciesName asc, and no where filter at all", async () => {
    prisma.species.findMany.mockResolvedValueOnce([]);

    await request(app).get("/api/v1/species");

    expect(prisma.species.findMany).toHaveBeenCalledWith({
      orderBy: { speciesName: "asc" },
      select: { speciesID: true, speciesName: true },
    });
  });

  test("returned order is passed through unchanged, not re-sorted or reversed", async () => {
    const alreadySorted = [
      { speciesID: 2, speciesName: "Bird" },
      { speciesID: 1, speciesName: "Cat" },
      { speciesID: 3, speciesName: "Dog" },
    ];
    prisma.species.findMany.mockResolvedValueOnce(alreadySorted);

    const res = await request(app).get("/api/v1/species");

    expect(res.body.data.map((s) => s.speciesName)).toEqual([
      "Bird",
      "Cat",
      "Dog",
    ]);
  });

  test("response shape is speciesID/speciesName only — no stray fields", async () => {
    prisma.species.findMany.mockResolvedValueOnce([
      { speciesID: 1, speciesName: "Dog" },
    ]);

    const res = await request(app).get("/api/v1/species");

    expect(res.body.data[0]).toEqual({ speciesID: 1, speciesName: "Dog" });
    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ["speciesID", "speciesName"].sort(),
    );
  });

  test("response is a plain array, not wrapped in a pagination object", async () => {
    prisma.species.findMany.mockResolvedValueOnce([
      { speciesID: 1, speciesName: "Dog" },
    ]);

    const res = await request(app).get("/api/v1/species");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(
      ["success", "message", "data"].sort(),
    );
  });

  test("zero species → returns an empty array, not an error", async () => {
    prisma.species.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/v1/species");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("unexpected DB error → 500 INTERNAL_SERVER_ERROR, not an unhandled crash", async () => {
    prisma.species.findMany.mockRejectedValueOnce(new Error("connection lost"));

    const res = await request(app).get("/api/v1/species");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  });
});
