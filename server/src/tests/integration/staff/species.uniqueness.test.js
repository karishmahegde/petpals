require("dotenv").config(); // this suite doesn't load app.js, which is what loads .env for the others
const prisma = require("../../../config/prisma");
const speciesService = require("../../../services/staff/species.service");

// Runs against the DATABASE_URL configured in server/.env. Exercises the
// case-insensitive unique indexes from migration
// 20260927060418_species_breed_name_ci_unique for real: the unit suite can
// only fake the unique-violation error, not prove the index raises it or
// that the error it raises is one isUniqueViolation recognises. Every row it
// creates is named Integration*Unique* and removed in afterAll.

const SPECIES_NAME = "IntegrationUniqueSpecies";
const BREED_NAME = "IntegrationUniqueBreed";

describe("Species/breed name uniqueness (DB indexes)", () => {
  let species;

  beforeAll(async () => {
    species = await prisma.species.create({ data: { speciesName: SPECIES_NAME } });
  });

  afterAll(async () => {
    const all = await prisma.species.findMany({
      where: { speciesName: { startsWith: "IntegrationUnique", mode: "insensitive" } },
      select: { speciesID: true },
    });
    const speciesIDs = all.map((s) => s.speciesID);
    await prisma.breed.deleteMany({ where: { speciesID: { in: speciesIDs } } });
    await prisma.species.deleteMany({ where: { speciesID: { in: speciesIDs } } });
    await prisma.$disconnect();
  });

  // Straight to Prisma, skipping the service's pre-check — only the index
  // stands in the way.
  test("the DB rejects a species name differing only in case", async () => {
    await expect(
      prisma.species.create({ data: { speciesName: SPECIES_NAME.toLowerCase() } }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(P2002|23505)$/) });
  });

  test("the DB rejects a breed name differing only in case, within the same species", async () => {
    await prisma.breed.create({ data: { speciesID: species.speciesID, breedName: BREED_NAME } });

    await expect(
      prisma.breed.create({
        data: { speciesID: species.speciesID, breedName: BREED_NAME.toUpperCase() },
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(P2002|23505)$/) });
  });

  test("the same breed name is still allowed under a different species", async () => {
    const other = await prisma.species.create({
      data: { speciesName: `${SPECIES_NAME}Other` },
    });

    await expect(
      prisma.breed.create({ data: { speciesID: other.speciesID, breedName: BREED_NAME } }),
    ).resolves.toMatchObject({ breedName: BREED_NAME });
  });

  // The race the index exists for: both calls can pass the service's
  // up-front check before either inserts. Exactly one must win, and the
  // loser must surface as the same CONFLICT the pre-check would give.
  test("two concurrent creates differing only in case → one succeeds, one CONFLICT", async () => {
    const results = await Promise.allSettled([
      speciesService.createSpecies({ speciesName: "IntegrationUniqueRace" }),
      speciesService.createSpecies({ speciesName: "integrationuniquerace" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe("CONFLICT");
  });
});
