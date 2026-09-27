const request = require("supertest");

const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Replicates pets.service.js's formatAgeFromDOBYears exactly, so the
// "correct petAge" assertion checks the actual computed value — not just
// that it looks like a formatted string (already covered by the unit
// tests). No fake timers: age math here is only day-granularity, and
// capturing "today" immediately before the request is deterministic enough
// in practice (see pets.getAvailablePets.test.js in tests/unit for the same
// reasoning).
const formatAgeFromDOBYears = (dob, today) => {
  const dobDate = new Date(dob);
  let totalMonths =
    (today.getFullYear() - dobDate.getFullYear()) * 12 +
    (today.getMonth() - dobDate.getMonth());
  if (today.getDate() < dobDate.getDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const unitYr = years > 1 ? "yrs" : "yr";
  if (years === 0) return `~${months} mo`;
  return `~${years} ${unitYr}`;
};

// GET /pets has no corresponding create-pet endpoint yet (pets are seeded
// via seed.js / managed by staff tooling not built until a later sprint),
// so — unlike the auth integration tests, which seed via API calls — this
// suite seeds its full dependency chain directly via Prisma, and cleans it
// all up in afterAll. Every test-only row uses an "IntegrationList*" prefix
// so cleanup queries can't accidentally sweep up real seeded data.
describe("GET /api/v1/pets (integration)", () => {
  let speciesDog;
  let speciesCat;
  let shelterMain;
  let shelterOnlyA;
  let shelterOnlyB;
  let allSpeciesIDs;
  let allShelterIDs;
  let ageCheckDOB;

  const yearsAgo = (n, ref) =>
    new Date(ref.getFullYear() - n, ref.getMonth(), ref.getDate());
  const monthsAgo = (n, ref) => {
    const d = new Date(ref);
    d.setMonth(d.getMonth() - n);
    return d;
  };

  const makePet = (overrides) =>
    prisma.pet.create({
      data: {
        petName: "Test",
        petDOB: yearsAgo(2, new Date()),
        petWeight: 20,
        petHeight: 40,
        petBGroup: "DEA4+",
        petColor: "Brown",
        petSize: "Medium",
        petPhoto: "https://example.com/test.jpg",
        petSex: "M",
        intakeDate: new Date(2023, 0, 1),
        adoptionStatus: "available",
        shelterID: shelterMain.shelterID,
        ...overrides,
      },
    });

  beforeAll(async () => {
    speciesDog = await prisma.species.create({
      data: { speciesName: "IntegrationListSpeciesDog" },
    });
    speciesCat = await prisma.species.create({
      data: { speciesName: "IntegrationListSpeciesCat" },
    });
    allSpeciesIDs = [speciesDog.speciesID, speciesCat.speciesID];

    shelterMain = await prisma.shelter.create({
      data: {
        shelterName: "IntegrationListShelterMain",
        shelterAddress: "1 Test Way, Testville, NY 10001",
        shelterPhone: "555-0100",
        shelterEmail: `shelterMain${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 50,
        shelterStatus: "Open",
      },
    });
    shelterOnlyA = await prisma.shelter.create({
      data: {
        shelterName: "IntegrationListShelterOnlyA",
        shelterAddress: "2 Test Way, Testville, NY 10002",
        shelterPhone: "555-0200",
        shelterEmail: `shelterOnlyA${Date.now()}@ex.com`,
        shelterZIP: 10002,
        shelterSize: 20,
        shelterStatus: "Open",
      },
    });
    shelterOnlyB = await prisma.shelter.create({
      data: {
        shelterName: "IntegrationListShelterOnlyB",
        shelterAddress: "3 Test Way, Testville, NY 10003",
        shelterPhone: "555-0300",
        shelterEmail: `shelterOnlyB${Date.now()}@ex.com`,
        shelterZIP: 10003,
        shelterSize: 20,
        shelterStatus: "Open",
      },
    });
    allShelterIDs = [
      shelterMain.shelterID,
      shelterOnlyA.shelterID,
      shelterOnlyB.shelterID,
    ];

    // ── Combined species+breed+size+age dataset ──────────────────────
    // Two breeds share the exact same breedName across different species —
    // schema permits this (no uniqueness constraint on breedName), and it's
    // a real edge case: a naive query that only filtered breedName (without
    // also constraining by the breed's speciesID) would leak the Cat pet
    // into a species=Dog result set.
    const breedShared = await prisma.breed.create({
      data: {
        speciesID: speciesDog.speciesID,
        breedName: "IntegrationListBreedShared",
      },
    });
    const breedSharedOtherSpecies = await prisma.breed.create({
      data: {
        speciesID: speciesCat.speciesID,
        breedName: "IntegrationListBreedShared",
      },
    });

    const now = new Date();
    await makePet({
      petName: "ComboMatch",
      breedID: breedShared.breedID,
      petSize: "Medium",
      petDOB: yearsAgo(2, now),
    });
    await makePet({
      petName: "ComboSameBreedNameOtherSpecies",
      breedID: breedSharedOtherSpecies.breedID,
      petSize: "Medium",
      petDOB: yearsAgo(2, now),
    });
    await makePet({
      petName: "ComboWrongSize",
      breedID: breedShared.breedID,
      petSize: "Large",
      petDOB: yearsAgo(2, now),
    });
    await makePet({
      petName: "ComboWrongAge",
      breedID: breedShared.breedID,
      petSize: "Medium",
      petDOB: monthsAgo(3, now),
    });

    // ── ShelterID repeated-param dataset ──────────────────────────────
    // A dedicated breed/pet per shelter, isolated in shelters that no
    // other test pet lives in, so the shelterID filter's result set is
    // exactly and only whatever these two pets contribute.
    const breedForShelterTest = await prisma.breed.create({
      data: {
        speciesID: speciesDog.speciesID,
        breedName: "IntegrationListBreedShelterTest",
      },
    });
    await makePet({
      petName: "ShelterAOnly",
      breedID: breedForShelterTest.breedID,
      shelterID: shelterOnlyA.shelterID,
    });
    await makePet({
      petName: "ShelterBOnly",
      breedID: breedForShelterTest.breedID,
      shelterID: shelterOnlyB.shelterID,
    });

    // ── Pagination dataset ────────────────────────────────────────────
    // A breed used by exactly 5 pets and nothing else, so filtering by it
    // gives a fully isolated, exact-count universe for pagination math —
    // unaffected by any other pet created in this suite.
    const breedPagination = await prisma.breed.create({
      data: {
        speciesID: speciesDog.speciesID,
        breedName: "IntegrationListBreedPagination",
      },
    });
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await makePet({ petName: `Page${i}`, breedID: breedPagination.breedID });
    }

    // ── Age round-trip dataset ─────────────────────────────────────────
    const breedAgeCheck = await prisma.breed.create({
      data: {
        speciesID: speciesDog.speciesID,
        breedName: "IntegrationListBreedAgeCheck",
      },
    });
    ageCheckDOB = yearsAgo(3, now);
    await makePet({
      petName: "AgeCheckPet",
      breedID: breedAgeCheck.breedID,
      petDOB: ageCheckDOB,
    });
  });

  afterAll(async () => {
    await prisma.pet.deleteMany({
      where: { shelterID: { in: allShelterIDs } },
    });
    await prisma.breed.deleteMany({
      where: { speciesID: { in: allSpeciesIDs } },
    });
    await prisma.species.deleteMany({
      where: { speciesID: { in: allSpeciesIDs } },
    });
    await prisma.shelter.deleteMany({
      where: { shelterID: { in: allShelterIDs } },
    });
    await prisma.$disconnect();
  });

  test("combined species+breed+size+age filters together → correct AND'd results", async () => {
    const res = await request(app).get("/api/v1/pets").query({
      species: speciesDog.speciesID,
      breed: "IntegrationListBreedShared",
      size: "Medium",
      minAge: 12, // months
      limit: 100,
    });

    expect(res.status).toBe(200);
    const names = res.body.data.map((p) => p.petName);

    expect(names).toContain("ComboMatch");
    expect(names).not.toContain("ComboSameBreedNameOtherSpecies");
    expect(names).not.toContain("ComboWrongSize");
    expect(names).not.toContain("ComboWrongAge");
  });

  test("combined shelter+location merge (via repeated shelterID params) → correct results", async () => {
    const onlyBRes = await request(app)
      .get("/api/v1/pets")
      .query({ shelterID: shelterOnlyB.shelterID, limit: 100 });

    expect(onlyBRes.body.data.map((p) => p.petName)).toEqual(["ShelterBOnly"]);

    const bothRes = await request(app).get(
      `/api/v1/pets?shelterID=${shelterOnlyA.shelterID}&shelterID=${shelterOnlyB.shelterID}&limit=100`,
    );

    // Repeated shelterID is OR'd, not AND'd — a naive intersection would
    // yield an empty result here, since no pet belongs to both shelters.
    expect(bothRes.body.data.map((p) => p.petName).sort()).toEqual([
      "ShelterAOnly",
      "ShelterBOnly",
    ]);
  });

  test("pagination across multiple pages → consistent, non-overlapping results", async () => {
    const commonQuery = { breed: "IntegrationListBreedPagination", limit: 2 };

    const page1 = await request(app)
      .get("/api/v1/pets")
      .query({ ...commonQuery, page: 1 });
    const page2 = await request(app)
      .get("/api/v1/pets")
      .query({ ...commonQuery, page: 2 });
    const page3 = await request(app)
      .get("/api/v1/pets")
      .query({ ...commonQuery, page: 3 });

    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    expect(page2.body.pagination).toMatchObject({
      page: 2,
      total: 5,
      totalPages: 3,
    });
    expect(page3.body.pagination).toMatchObject({
      page: 3,
      total: 5,
      totalPages: 3,
    });

    expect(page1.body.data).toHaveLength(2);
    expect(page2.body.data).toHaveLength(2);
    expect(page3.body.data).toHaveLength(1);

    const page1IDs = page1.body.data.map((p) => p.petID);
    const page2IDs = page2.body.data.map((p) => p.petID);
    const page3IDs = page3.body.data.map((p) => p.petID);

    // Non-overlapping — no pet appears on more than one page.
    expect(page1IDs.filter((id) => page2IDs.includes(id))).toEqual([]);
    expect(page2IDs.filter((id) => page3IDs.includes(id))).toEqual([]);
    expect(page1IDs.filter((id) => page3IDs.includes(id))).toEqual([]);

    // Consistent — the union across all pages is exactly the 5 seeded pets.
    const allIDs = [...page1IDs, ...page2IDs, ...page3IDs];
    expect(new Set(allIDs).size).toBe(5);
  });

  test("full round trip returns correct petAge computed from live petDOB", async () => {
    const requestTime = new Date();
    const res = await request(app)
      .get("/api/v1/pets")
      .query({ breed: "IntegrationListBreedAgeCheck", limit: 100 });

    expect(res.status).toBe(200);
    const pet = res.body.data.find((p) => p.petName === "AgeCheckPet");
    expect(pet).toBeDefined();
    expect(pet.petAge).toBe(formatAgeFromDOBYears(ageCheckDOB, requestTime));
    expect(pet).not.toHaveProperty("petDOB");
  });
});
