const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

jest.setTimeout(20000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const registerAndLoginAdopter = async (name) => {
  const payload = {
    name,
    email: uniqueEmail(),
    password: "Secret123!",
    role: "adopter",
  };
  const registerRes = await request(app)
    .post("/api/v1/auth/register")
    .send(payload);
  const userID = registerRes.body.data.userID;
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

describe("favorites, adopted pets, and vaccinations", () => {
  let speciesID;
  let breedID;
  let shelterID;
  let petFavID; // used for the favorites POST/DELETE/list tests
  let petAcceptedAdoptedID; // Accepted application + adoptionStatus 'adopted' — the one real "adopted pet"
  let petAcceptedNotAdoptedID; // Accepted application, but pet still 'pending' — must NOT show as adopted
  let petPendingAdoptedID; // pet already 'adopted', but this adopter's application is only 'Pending'
  let vaccineID;
  let adopterA;
  let adopterB;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `FavAdoptedVaxTestSpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "FavAdoptedVaxTestBreed" },
    });
    breedID = breed.breedID;

    const shelter = await prisma.shelter.create({
      data: {
        shelterName: "Fav/Adopted/Vax Test Shelter",
        shelterAddress: "1 Test Way",
        shelterPhone: "555-0100",
        shelterEmail: `shelter${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 10,
      },
    });
    shelterID = shelter.shelterID;

    const petData = {
      breedID,
      petDOB: new Date("2020-01-01"),
      petWeight: 10,
      petHeight: 10,
      petBGroup: "N/A",
      petColor: "Brown",
      petPhoto: "placeholder.jpg",
      petSex: "M",
      intakeDate: new Date(),
      shelterID,
    };
    const makePet = (petName, adoptionStatus) =>
      prisma.pet.create({ data: { ...petData, petName, adoptionStatus } });

    petFavID = (await makePet("Favorite Testy", "available")).petID;
    petAcceptedAdoptedID = (await makePet("Accepted+Adopted Testy", "adopted")).petID;
    petAcceptedNotAdoptedID = (await makePet("Accepted+Pending Testy", "pending")).petID;
    petPendingAdoptedID = (await makePet("Pending+Adopted Testy", "adopted")).petID;

    const vaccine = await prisma.vaccine.create({
      data: { vaccineName: "TestVax-Rabies" },
    });
    vaccineID = vaccine.vaccineID;

    adopterA = await registerAndLoginAdopter("Fav/Adopted/Vax Test Adopter A");
    adopterB = await registerAndLoginAdopter("Fav/Adopted/Vax Test Adopter B");

    // adopterA's adoption applications, driving the three pets above.
    await prisma.adoptionApplication.create({
      data: {
        adopterID: adopterA.userID,
        petID: petAcceptedAdoptedID,
        shelterID,
        applicationStatus: "Accepted",
        stripeCheckoutSessionID: `cs_test_fake_${adopterA.userID}_${petAcceptedAdoptedID}`,
      },
    });
    await prisma.adoptionApplication.create({
      data: {
        adopterID: adopterA.userID,
        petID: petAcceptedNotAdoptedID,
        shelterID,
        applicationStatus: "Accepted",
        stripeCheckoutSessionID: `cs_test_fake_${adopterA.userID}_${petAcceptedNotAdoptedID}`,
      },
    });
    await prisma.adoptionApplication.create({
      data: {
        adopterID: adopterA.userID,
        petID: petPendingAdoptedID,
        shelterID,
        applicationStatus: "Pending",
        stripeCheckoutSessionID: `cs_test_fake_${adopterA.userID}_${petPendingAdoptedID}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({
      where: { adopterID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.vaccinationRecord.deleteMany({ where: { vaccineID } });
    await prisma.vaccine.deleteMany({ where: { vaccineID } });
    await prisma.adoptionApplication.deleteMany({
      where: { adopterID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.adopter.deleteMany({
      where: { userID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.users.deleteMany({
      where: { userID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.pet.deleteMany({
      where: {
        petID: {
          in: [petFavID, petAcceptedAdoptedID, petAcceptedNotAdoptedID, petPendingAdoptedID],
        },
      },
    });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.shelter.deleteMany({ where: { shelterID } });
    await prisma.$disconnect();
  });

  // ——————————————————— POST /pets/:id/favorites ———————————————————
  describe("POST /api/v1/pets/:id/favorites", () => {
    test("success -> 201", async () => {
      const res = await request(app)
        .post(`/api/v1/pets/${petFavID}/favorites`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const row = await prisma.favorite.findUnique({
        where: { adopterID_petID: { adopterID: adopterA.userID, petID: petFavID } },
      });
      expect(row).not.toBeNull();

      await prisma.favorite.deleteMany({
        where: { adopterID: adopterA.userID, petID: petFavID },
      });
    });

    test("duplicate -> 409 CONFLICT", async () => {
      await prisma.favorite.create({
        data: { adopterID: adopterA.userID, petID: petFavID },
      });

      const res = await request(app)
        .post(`/api/v1/pets/${petFavID}/favorites`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");

      await prisma.favorite.deleteMany({
        where: { adopterID: adopterA.userID, petID: petFavID },
      });
    });
  });

  // ——————————————————— DELETE /pets/:id/favorites ———————————————————
  describe("DELETE /api/v1/pets/:id/favorites", () => {
    test("success -> 200", async () => {
      await prisma.favorite.create({
        data: { adopterID: adopterA.userID, petID: petFavID },
      });

      const res = await request(app)
        .delete(`/api/v1/pets/${petFavID}/favorites`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const row = await prisma.favorite.findUnique({
        where: { adopterID_petID: { adopterID: adopterA.userID, petID: petFavID } },
      });
      expect(row).toBeNull();
    });

    test("not found -> 404 NOT_FOUND", async () => {
      // No favorite exists for this adopter/pet pair at this point.
      const res = await request(app)
        .delete(`/api/v1/pets/${petFavID}/favorites`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ——————————————————— GET /adopters/me/favorites ———————————————————
  describe("GET /api/v1/adopters/me/favorites", () => {
    test("returns only this adopter's favorites, with full pet detail", async () => {
      await prisma.favorite.create({
        data: { adopterID: adopterA.userID, petID: petFavID },
      });
      await prisma.favorite.create({
        data: { adopterID: adopterB.userID, petID: petFavID },
      });

      const res = await request(app)
        .get("/api/v1/adopters/me/favorites")
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      const favoritePet = res.body.data[0];
      expect(favoritePet.petID).toBe(petFavID);
      // Full PetDetail shape (GET /pets/:id shape), not the slim PetCard —
      // confirmed by fields the card shape doesn't carry.
      expect(favoritePet).toHaveProperty("petHeight");
      expect(favoritePet).toHaveProperty("petWeight");
      expect(favoritePet).toHaveProperty("compatibleWithChildren");
      expect(favoritePet.shelter).toHaveProperty("shelterAddress");

      await prisma.favorite.deleteMany({
        where: { adopterID: { in: [adopterA.userID, adopterB.userID] }, petID: petFavID },
      });
    });
  });

  // ——————————————————— GET /adopters/me/adopted-pets ———————————————————
  describe("GET /api/v1/adopters/me/adopted-pets", () => {
    test("returns only pets with an Accepted application AND adoptionStatus='adopted'", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me/adopted-pets")
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((p) => p.petID);

      expect(ids).toContain(petAcceptedAdoptedID); // Accepted + adopted -> included
      expect(ids).not.toContain(petAcceptedNotAdoptedID); // Accepted, but pet not yet 'adopted' -> excluded
      expect(ids).not.toContain(petPendingAdoptedID); // pet 'adopted', but application only Pending -> excluded
    });
  });

  // ————————————— GET /adopters/me/adopted-pets/:petId/vaccinations —————————————
  describe("GET /api/v1/adopters/me/adopted-pets/:petId/vaccinations", () => {
    test("adopter owns pet (Accepted application) -> 200 with records", async () => {
      const record = await prisma.vaccinationRecord.create({
        data: {
          petID: petAcceptedAdoptedID,
          vaccineID,
          administeredDate: new Date("2025-01-01"),
          dueDate: new Date("2026-01-01"),
        },
      });

      const res = await request(app)
        .get(`/api/v1/adopters/me/adopted-pets/${petAcceptedAdoptedID}/vaccinations`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].vaccineName).toBe("TestVax-Rabies");
      expect(res.body.data[0].recordID).toBe(record.recordID);

      await prisma.vaccinationRecord.delete({ where: { recordID: record.recordID } });
    });

    test("adopter does not own pet -> 403 FORBIDDEN", async () => {
      // adopterB has no application at all for this pet.
      const res = await request(app)
        .get(`/api/v1/adopters/me/adopted-pets/${petAcceptedAdoptedID}/vaccinations`)
        .set("Authorization", `Bearer ${adopterB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
