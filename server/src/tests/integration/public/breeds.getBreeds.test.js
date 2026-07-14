const request = require("supertest");

const app = require("../../../app");
const prisma = require("../../../config/prisma");

// GET /breeds has no create-breed endpoint to seed through, so — unlike the
// auth integration tests — this suite seeds directly via Prisma and cleans
// up in afterAll. Unlike /pets/featured, this endpoint DOES accept a real
// filter (speciesID), so test data can be fully isolated and asserted with
// exact equality rather than containment checks.
describe("GET /api/v1/breeds (integration)", () => {
  let speciesA;
  let speciesB;
  let speciesEmpty;

  beforeAll(async () => {
    speciesA = await prisma.species.create({
      data: { speciesName: "IntegrationBreedsSpeciesA" },
    });
    speciesB = await prisma.species.create({
      data: { speciesName: "IntegrationBreedsSpeciesB" },
    });
    speciesEmpty = await prisma.species.create({
      data: { speciesName: "IntegrationBreedsSpeciesEmpty" },
    });

    // Inserted out of alphabetical order on purpose, to prove the response
    // ordering is a real DB sort, not just insertion order.
    await prisma.breed.create({
      data: { speciesID: speciesA.speciesID, breedName: "Zeta" },
    });
    await prisma.breed.create({
      data: { speciesID: speciesA.speciesID, breedName: "Alpha" },
    });
    await prisma.breed.create({
      data: { speciesID: speciesA.speciesID, breedName: "Mango" },
    });
    await prisma.breed.create({
      data: { speciesID: speciesB.speciesID, breedName: "Bravo" },
    });
    // speciesEmpty intentionally has zero breeds.
  });

  afterAll(async () => {
    await prisma.breed.deleteMany({
      where: {
        speciesID: {
          in: [speciesA.speciesID, speciesB.speciesID, speciesEmpty.speciesID],
        },
      },
    });
    await prisma.species.deleteMany({
      where: {
        speciesID: {
          in: [speciesA.speciesID, speciesB.speciesID, speciesEmpty.speciesID],
        },
      },
    });
    await prisma.$disconnect();
  });

  test("full round trip for a real species → correct breed set from DB, ordered alphabetically", async () => {
    const res = await request(app)
      .get("/api/v1/breeds")
      .query({ speciesID: speciesA.speciesID });

    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.breedName)).toEqual([
      "Alpha",
      "Mango",
      "Zeta",
    ]);
    expect(
      res.body.data.every((b) => b.speciesName === "IntegrationBreedsSpeciesA"),
    ).toBe(true);
  });

  test("response shape is breedID/breedName/speciesName only — no nested species object", async () => {
    const res = await request(app)
      .get("/api/v1/breeds")
      .query({ speciesID: speciesA.speciesID });

    for (const breed of res.body.data) {
      expect(Object.keys(breed).sort()).toEqual(
        ["breedID", "breedName", "speciesName"].sort(),
      );
      expect(typeof breed.breedID).toBe("number");
    }
  });

  test("multiple speciesID (repeated param) → union of breeds, ordered by species name then breed name", async () => {
    const res = await request(app).get(
      `/api/v1/breeds?speciesID=${speciesA.speciesID}&speciesID=${speciesB.speciesID}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.breedName)).toEqual([
      "Alpha",
      "Mango",
      "Zeta",
      "Bravo",
    ]);
  });

  test("a real species with zero breeds → returns an empty array, not an error", async () => {
    const res = await request(app)
      .get("/api/v1/breeds")
      .query({ speciesID: speciesEmpty.speciesID });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("a well-formed but nonexistent speciesID → returns an empty array, not a 404", async () => {
    const res = await request(app)
      .get("/api/v1/breeds")
      .query({ speciesID: 999999999 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("no speciesID → returns an empty array without a DB round trip at all", async () => {
    const res = await request(app).get("/api/v1/breeds");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("invalid speciesID → 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .get("/api/v1/breeds")
      .query({ speciesID: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
