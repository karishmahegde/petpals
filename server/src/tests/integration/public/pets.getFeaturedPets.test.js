const request = require("supertest");

const app = require("../../../app");
const prisma = require("../../../config/prisma");

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

// GET /pets/featured has no query filters at all — it always returns every
// featured+available pet globally, so (unlike the /pets list suite) test
// rows can't be isolated from real seeded data via a query param. Every
// assertion below is containment-based (toContain/not.toContain against
// this suite's own pet names) rather than exact-array-equality, since the
// real response will also include whatever pre-existing featured pets
// already exist in the DB from seed.js.
describe("GET /api/v1/pets/featured (integration)", () => {
  let species;
  let breed;
  let shelter;
  let ageCheckDOB;

  const yearsAgo = (n, ref) =>
    new Date(ref.getFullYear() - n, ref.getMonth(), ref.getDate());

  const makePet = (overrides) =>
    prisma.pet.create({
      data: {
        petName: "Test",
        petDOB: new Date(2020, 0, 1),
        petWeight: 20,
        petHeight: 40,
        petBGroup: "DEA4+",
        petColor: "Brown",
        petSize: "Medium",
        petPhoto: "https://example.com/test.jpg",
        petSex: "M",
        intakeDate: new Date(2023, 0, 1),
        breedID: breed.breedID,
        shelterID: shelter.shelterID,
        featuredFlag: false,
        adoptionStatus: "available",
        ...overrides,
      },
    });

  beforeAll(async () => {
    species = await prisma.species.create({
      data: { speciesName: "IntegrationFeaturedSpecies" },
    });
    breed = await prisma.breed.create({
      data: {
        speciesID: species.speciesID,
        breedName: "IntegrationFeaturedBreed",
      },
    });
    shelter = await prisma.shelter.create({
      data: {
        shelterName: "IntegrationFeaturedShelter",
        shelterAddress: "1 Test Way, Testville, NY 10001",
        shelterPhone: "555-0100",
        shelterEmail: `shelterFeatured${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 50,
        shelterStatus: "Open",
      },
    });

    const now = new Date();
    ageCheckDOB = yearsAgo(2, now);

    // The one pet that should actually surface — featured AND available.
    await makePet({
      petName: "FeaturedAvailable",
      featuredFlag: true,
      adoptionStatus: "available",
      petDOB: ageCheckDOB,
      petSex: "F",
      petPhoto: "https://example.com/featured-available.jpg",
    });

    // Featured, but not available — two different non-available statuses,
    // to confirm the exclusion isn't hardcoded to just one enum value.
    await makePet({
      petName: "FeaturedPending",
      featuredFlag: true,
      adoptionStatus: "pending",
    });
    await makePet({
      petName: "FeaturedAdopted",
      featuredFlag: true,
      adoptionStatus: "adopted",
    });

    // Available, but not featured.
    await makePet({
      petName: "NotFeaturedAvailable",
      featuredFlag: false,
      adoptionStatus: "available",
    });

    // Neither featured nor available — pure noise, should never surface.
    await makePet({
      petName: "NotFeaturedPending",
      featuredFlag: false,
      adoptionStatus: "pending",
    });
  });

  afterAll(async () => {
    await prisma.pet.deleteMany({ where: { shelterID: shelter.shelterID } });
    await prisma.breed.delete({ where: { breedID: breed.breedID } });
    await prisma.species.delete({ where: { speciesID: species.speciesID } });
    await prisma.shelter.delete({ where: { shelterID: shelter.shelterID } });
    await prisma.$disconnect();
  });

  test("seed a mix of featured/non-featured/unavailable pets → only the featured+available subset is returned", async () => {
    const res = await request(app).get("/api/v1/pets/featured");

    expect(res.status).toBe(200);
    const names = res.body.data.map((p) => p.petName);

    expect(names).toContain("FeaturedAvailable");
    expect(names).not.toContain("FeaturedPending");
    expect(names).not.toContain("FeaturedAdopted");
    expect(names).not.toContain("NotFeaturedAvailable");
    expect(names).not.toContain("NotFeaturedPending");
  });

  test("full round trip returns correctly shaped data for the featured pet", async () => {
    const requestTime = new Date();
    const res = await request(app).get("/api/v1/pets/featured");

    const pet = res.body.data.find((p) => p.petName === "FeaturedAvailable");
    expect(pet).toBeDefined();
    expect(pet).toMatchObject({
      petSex: "Female",
      petPhoto: "https://example.com/featured-available.jpg",
      breed: {
        breedName: "IntegrationFeaturedBreed",
        speciesName: "IntegrationFeaturedSpecies",
      },
    });
    expect(pet.petAge).toBe(formatAgeFromDOBYears(ageCheckDOB, requestTime));
    expect(pet).not.toHaveProperty("petDOB");
  });

  test("response is a plain array, not wrapped in a pagination object", async () => {
    const res = await request(app).get("/api/v1/pets/featured");

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeUndefined();
  });
});
