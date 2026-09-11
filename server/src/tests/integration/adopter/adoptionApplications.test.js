const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Stripe Checkout Session creation (real, test-mode API calls) on top of the
// usual register + login + HTTP round trips — the 5s Jest default is too
// tight for that.
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

// POST /adoption-applications only ever starts a Stripe Checkout Session (see
// adoptionApplications.service.js createCheckoutSession) — the
// AdoptionApplication row itself is created later, by the payment webhook
// (finalizeApplication), not synchronously. There is no HTTP endpoint that
// creates a row directly, so every test here that needs one as a
// precondition creates it via Prisma instead — same convention already used
// in adopters.closeAccount.test.js for the same reason.
const seedApplication = ({ adopterID, petID, shelterID, applicationStatus = "Pending" }) =>
  prisma.adoptionApplication.create({
    data: {
      adopterID,
      petID,
      shelterID,
      applicationType: "Adopt",
      applicationStatus,
      // NOT NULL in the schema with no default — a real webhook-created row
      // always has a real Stripe session id; a unique fake stands in here.
      stripeCheckoutSessionID: `cs_test_fake_${adopterID}_${petID}_${Date.now()}_${Math.random()}`,
    },
  });

describe("adoption applications", () => {
  let speciesID;
  let breedID;
  let shelterID;
  let petAvailableID;
  let petUnavailableID;
  let adopterA; // primary adopter used across most tests
  let adopterB; // second adopter, for cross-adopter access-control cases

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `ApplicationTestSpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "ApplicationTestBreed" },
    });
    breedID = breed.breedID;

    const shelter = await prisma.shelter.create({
      data: {
        shelterName: "Application Test Shelter",
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

    const petAvailable = await prisma.pet.create({
      data: { ...petData, petName: "Available Testy", adoptionStatus: "available" },
    });
    petAvailableID = petAvailable.petID;

    const petUnavailable = await prisma.pet.create({
      data: { ...petData, petName: "Unavailable Testy", adoptionStatus: "pending" },
    });
    petUnavailableID = petUnavailable.petID;

    adopterA = await registerAndLoginAdopter("Application Test Adopter A");
    adopterB = await registerAndLoginAdopter("Application Test Adopter B");
  });

  afterAll(async () => {
    // Every test that seeds a row deletes it itself (each test's own active
    // Pending row would otherwise collide with the next test's, via the
    // partial unique index on (adopterID, petID)) — this is just a safety
    // net in case a failed assertion skipped that cleanup.
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
      where: { petID: { in: [petAvailableID, petUnavailableID] } },
    });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.shelter.deleteMany({ where: { shelterID } });
    await prisma.$disconnect();
  });

  // ——————————————————— POST /adoption-applications ———————————————————
  describe("POST /api/v1/adoption-applications", () => {
    test("valid payload -> 201 with a Stripe Checkout URL (the row itself is created later, by the webhook)", async () => {
      const res = await request(app)
        .post("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({
          petID: petAvailableID,
          shelterID,
          applicationType: "Adopt",
          shelterMessage: "We'd love to meet this pet!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.checkoutUrl).toBe("string");
      expect(res.body.data.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);

      // No row exists yet — nothing has been "paid" (no webhook fired).
      const rows = await prisma.adoptionApplication.findMany({
        where: { adopterID: adopterA.userID, petID: petAvailableID },
      });
      expect(rows).toHaveLength(0);
    });

    test("pet not available -> 409 CONFLICT", async () => {
      const res = await request(app)
        .post("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({ petID: petUnavailableID, shelterID, applicationType: "Adopt" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    test("duplicate application for same pet -> 409 CONFLICT", async () => {
      const existing = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
      });

      const res = await request(app)
        .post("/api/v1/adoption-applications")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({ petID: petAvailableID, shelterID, applicationType: "Adopt" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");

      // Still just the one row — no second application was created.
      const rows = await prisma.adoptionApplication.findMany({
        where: { adopterID: adopterA.userID, petID: petAvailableID },
      });
      expect(rows).toHaveLength(1);

      await prisma.adoptionApplication.delete({
        where: { applicationID: existing.applicationID },
      });
    });

    test("unauthenticated -> 401 UNAUTHORIZED", async () => {
      const res = await request(app)
        .post("/api/v1/adoption-applications")
        .send({ petID: petAvailableID, shelterID, applicationType: "Adopt" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // ——————————————————— GET /adoption-applications/:id ———————————————————
  describe("GET /api/v1/adoption-applications/:id", () => {
    test("adopter retrieves own application -> 200", async () => {
      const app1 = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
      });

      const res = await request(app)
        .get(`/api/v1/adoption-applications/${app1.applicationID}`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applicationID).toBe(app1.applicationID);
      expect(res.body.data.adopterID).toBe(adopterA.userID);

      await prisma.adoptionApplication.delete({
        where: { applicationID: app1.applicationID },
      });
    });

    test("adopter retrieves another adopter's application -> 403 FORBIDDEN", async () => {
      const app1 = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
      });

      const res = await request(app)
        .get(`/api/v1/adoption-applications/${app1.applicationID}`)
        .set("Authorization", `Bearer ${adopterB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      await prisma.adoptionApplication.delete({
        where: { applicationID: app1.applicationID },
      });
    });

    test("non-existent ID -> 404 NOT_FOUND", async () => {
      const seeded = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
      });
      const freedID = seeded.applicationID;
      await prisma.adoptionApplication.delete({ where: { applicationID: freedID } });

      const res = await request(app)
        .get(`/api/v1/adoption-applications/${freedID}`)
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ——————————————————— GET /adopters/me/applications ———————————————————
  describe("GET /api/v1/adopters/me/applications", () => {
    test("returns only this adopter's applications", async () => {
      const ownApp = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
      });
      const otherApp = await seedApplication({
        adopterID: adopterB.userID,
        petID: petAvailableID,
        shelterID,
      });

      const res = await request(app)
        .get("/api/v1/adopters/me/applications")
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((a) => a.applicationID);
      expect(ids).toContain(ownApp.applicationID);
      expect(ids).not.toContain(otherApp.applicationID);
      expect(res.body.data.every((a) => a.adopterID === undefined)).toBe(true); // list shape doesn't leak adopterID either — see AdoptionApplicationListItem

      await prisma.adoptionApplication.deleteMany({
        where: { applicationID: { in: [ownApp.applicationID, otherApp.applicationID] } },
      });
    });

    test("status filter -> correct subset returned", async () => {
      const pending = await seedApplication({
        adopterID: adopterA.userID,
        petID: petAvailableID,
        shelterID,
        applicationStatus: "Pending",
      });
      const rejected = await seedApplication({
        adopterID: adopterA.userID,
        petID: petUnavailableID, // different pet — avoids the active-application unique index
        shelterID,
        applicationStatus: "Rejected",
      });
      const res = await request(app)
        .get("/api/v1/adopters/me/applications")
        .query({ status: "Rejected" })
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((a) => a.applicationID);
      expect(ids).toContain(rejected.applicationID);
      expect(ids).not.toContain(pending.applicationID);
      expect(res.body.data.every((a) => a.applicationStatus === "Rejected")).toBe(
        true,
      );

      await prisma.adoptionApplication.deleteMany({
        where: { applicationID: { in: [pending.applicationID, rejected.applicationID] } },
      });
    });
  });
});
