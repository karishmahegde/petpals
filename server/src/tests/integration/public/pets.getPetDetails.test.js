const request = require("supertest");

const app = require("../../../app");
const prisma = require("../../../config/prisma");

// GET /pets/:id has no corresponding create-pet endpoint yet (pets are
// seeded via seed.js / managed by staff tooling not built until a later
// sprint), so — unlike the auth integration tests, which seed via API
// calls — this suite seeds its full dependency chain (Species -> Breed,
// Shelter) directly via Prisma, and cleans it all up in afterAll.
describe("GET /api/v1/pets/:id (integration)", () => {
  let species;
  let breed;
  let shelter;
  let pet;
  let deletedPetID; // created, then deleted, to get a real-but-freed ID for the 404 case

  beforeAll(async () => {
    species = await prisma.species.create({
      data: { speciesName: "IntegrationTestSpecies" },
    });

    breed = await prisma.breed.create({
      data: { speciesID: species.speciesID, breedName: "IntegrationTestBreed" },
    });

    shelter = await prisma.shelter.create({
      data: {
        shelterName: "IntegrationTest Shelter",
        shelterAddress: "1 Test Way, Testville, NY 10001",
        shelterPhone: "555-0100",
        shelterEmail: `shelter${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 50,
        shelterStatus: "Open",
      },
    });

    pet = await prisma.pet.create({
      data: {
        petName: "Buddy",
        breedID: breed.breedID,
        petDOB: new Date(2020, 0, 1),
        petWeight: 28.5,
        petHeight: 55,
        petBGroup: "DEA4+",
        petColor: "Golden",
        petSize: "Medium",
        petPhoto: "https://example.com/buddy.jpg",
        petSex: "M",
        petDesc: "Friendly and energetic.",
        intakeDate: new Date(2023, 5, 1),
        intakeType: "stray",
        adoptionStatus: "available",
        shelterID: shelter.shelterID,
        compatibleWithChildren: true,
        compatibleWithPets: false,
        specialNeeds: false,
      },
    });

    // Created and immediately deleted so its ID is guaranteed unused —
    // safer than guessing a large integer, which risks either colliding
    // with a real row or overflowing Postgres's 4-byte `integer` type.
    const throwawayPet = await prisma.pet.create({
      data: {
        petName: "Throwaway",
        breedID: breed.breedID,
        petDOB: new Date(2020, 0, 1),
        petWeight: 10,
        petHeight: 30,
        petBGroup: "DEA4+",
        petColor: "Black",
        petPhoto: "https://example.com/throwaway.jpg",
        petSex: "F",
        intakeDate: new Date(2023, 5, 1),
        shelterID: shelter.shelterID,
      },
    });
    deletedPetID = throwawayPet.petID;
    await prisma.pet.delete({ where: { petID: deletedPetID } });
  });

  afterAll(async () => {
    await prisma.pet.deleteMany({ where: { shelterID: shelter.shelterID } });
    await prisma.breed.delete({ where: { breedID: breed.breedID } });
    await prisma.species.delete({ where: { speciesID: species.speciesID } });
    await prisma.shelter.delete({ where: { shelterID: shelter.shelterID } });
    await prisma.$disconnect();
  });

  test("full round trip for an existing pet → correct nested breed/species data", async () => {
    const res = await request(app).get(`/api/v1/pets/${pet.petID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      petID: pet.petID,
      petName: "Buddy",
      petSex: "Male",
      petPhoto: "https://example.com/buddy.jpg",
      petColor: "Golden",
      petHeight: 55,
      petWeight: 28.5,
      petDesc: "Friendly and energetic.",
      compatibleWithChildren: true,
      compatibleWithPets: false,
      specialNeeds: false,
      breed: {
        breedID: breed.breedID,
        breedName: "IntegrationTestBreed",
        speciesName: "IntegrationTestSpecies",
      },
      shelter: {
        shelterID: shelter.shelterID,
        shelterName: "IntegrationTest Shelter",
        shelterAddress: "1 Test Way, Testville, NY 10001",
      },
    });
    expect(typeof res.body.data.petAge).toBe("string");
    expect(res.body.data).not.toHaveProperty("petDOB");
  });

  test("404 round trip for a non-existent id", async () => {
    const res = await request(app).get(`/api/v1/pets/${deletedPetID}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(res.body.message).toMatch(new RegExp(String(deletedPetID)));
  });

  // ————————————————————————————— EXTRA CASES —————————————————————————————
  test("400 round trip for a malformed id — request never reaches the DB layer at all", async () => {
    const res = await request(app).get("/api/v1/pets/not-a-number");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  test("adoptionStatus is irrelevant here — a pet that is NOT 'available' is still returned by id", async () => {
    const adoptedPet = await prisma.pet.create({
      data: {
        petName: "AlreadyAdopted",
        breedID: breed.breedID,
        petDOB: new Date(2019, 0, 1),
        petWeight: 15,
        petHeight: 40,
        petBGroup: "DEA4+",
        petColor: "Brown",
        petPhoto: "https://example.com/adopted.jpg",
        petSex: "F",
        intakeDate: new Date(2023, 5, 1),
        adoptionStatus: "adopted",
        shelterID: shelter.shelterID,
      },
    });

    const res = await request(app).get(`/api/v1/pets/${adoptedPet.petID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.petID).toBe(adoptedPet.petID);

    await prisma.pet.delete({ where: { petID: adoptedPet.petID } });
  });

  test("a pet with a null petDesc returns null, not a placeholder string", async () => {
    const petNoDesc = await prisma.pet.create({
      data: {
        petName: "NoDescription",
        breedID: breed.breedID,
        petDOB: new Date(2021, 0, 1),
        petWeight: 12,
        petHeight: 35,
        petBGroup: "DEA4+",
        petColor: "White",
        petPhoto: "https://example.com/nodesc.jpg",
        petSex: "M",
        intakeDate: new Date(2023, 5, 1),
        shelterID: shelter.shelterID,
        // petDesc intentionally omitted — nullable column
      },
    });

    const res = await request(app).get(`/api/v1/pets/${petNoDesc.petID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.petDesc).toBeNull();

    await prisma.pet.delete({ where: { petID: petNoDesc.petID } });
  });
});
