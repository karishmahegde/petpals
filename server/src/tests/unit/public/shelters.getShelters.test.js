const request = require("supertest");

// Mocked so this suite never touches a real database — shelters.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too. Only `shelter.findMany` is
// exercised by GET /shelters — getNearbyShelters (a separate endpoint) uses
// prisma.$queryRaw and is out of scope for this suite.
jest.mock("../../../config/prisma", () => ({
  shelter: {
    findMany: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

describe("GET /api/v1/shelters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Since Prisma is mocked, the only way to actually verify "only Open
  // shelters, ordered alphabetically" as a unit test is to assert the exact
  // query the service builds — real filtering/sort correctness is the
  // database's job, which an integration test against a real DB would cover.
  test("queries only shelterStatus='Open', ordered by shelterName asc, no other filters", async () => {
    prisma.shelter.findMany.mockResolvedValueOnce([]);

    await request(app).get("/api/v1/shelters");

    expect(prisma.shelter.findMany).toHaveBeenCalledWith({
      where: { shelterStatus: "Open" },
      orderBy: { shelterName: "asc" },
      select: { shelterID: true, shelterName: true },
    });
  });

  test("returned order is passed through unchanged, not re-sorted or reversed", async () => {
    const alreadySorted = [
      { shelterID: 2, shelterName: "PetPals Brooklyn" },
      { shelterID: 1, shelterName: "PetPals Manhattan" },
      { shelterID: 3, shelterName: "PetPals Queens" },
    ];
    prisma.shelter.findMany.mockResolvedValueOnce(alreadySorted);

    const res = await request(app).get("/api/v1/shelters");

    expect(res.body.data.map((s) => s.shelterName)).toEqual([
      "PetPals Brooklyn",
      "PetPals Manhattan",
      "PetPals Queens",
    ]);
  });

  test("response shape is shelterID/shelterName only — no stray fields", async () => {
    prisma.shelter.findMany.mockResolvedValueOnce([
      { shelterID: 1, shelterName: "PetPals Brooklyn" },
    ]);

    const res = await request(app).get("/api/v1/shelters");

    expect(res.body.data[0]).toEqual({
      shelterID: 1,
      shelterName: "PetPals Brooklyn",
    });
    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ["shelterID", "shelterName"].sort(),
    );
  });

  test("response is a plain array, not wrapped in a pagination object", async () => {
    prisma.shelter.findMany.mockResolvedValueOnce([
      { shelterID: 1, shelterName: "PetPals Brooklyn" },
    ]);

    const res = await request(app).get("/api/v1/shelters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeUndefined();
    expect(Object.keys(res.body).sort()).toEqual(
      ["success", "message", "data"].sort(),
    );
  });

  test("zero open shelters → returns an empty array, not an error", async () => {
    prisma.shelter.findMany.mockResolvedValueOnce([]);

    const res = await request(app).get("/api/v1/shelters");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("unexpected DB error → 500 INTERNAL_SERVER_ERROR, not an unhandled crash", async () => {
    prisma.shelter.findMany.mockRejectedValueOnce(new Error("connection lost"));

    const res = await request(app).get("/api/v1/shelters");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  });
});
