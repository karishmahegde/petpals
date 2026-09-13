// Full request-response cycle tests for the core Sprint 3 adopter journeys —
// each test chains multiple real HTTP calls against the live test database
// (the same DATABASE_URL as every other integration test here), rather than
// exercising one endpoint/case in isolation the way the other files in this
// directory do. Some overlap with those files is expected and fine: the
// point of a journey test is proving the *chain* works end to end, not
// finding new edge cases.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const stripe = require("../../../config/stripe");

// Real Stripe Checkout Session creation + a locally-signed webhook delivery
// on top of the usual register/login/HTTP chains.
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

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("Sprint 3 adopter journeys", () => {
  let speciesID;
  let breedID;
  let shelterID;
  let petForAppID;
  let petForVisitID;
  let petForFavoriteID;
  let petForVaccinationID;
  let adopter;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `JourneyTestSpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "JourneyTestBreed" },
    });
    breedID = breed.breedID;

    const shelter = await prisma.shelter.create({
      data: {
        shelterName: "Journey Test Shelter",
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

    petForAppID = (await makePet("Journey App Testy", "available")).petID;
    petForVisitID = (await makePet("Journey Visit Testy", "available")).petID;
    petForFavoriteID = (await makePet("Journey Favorite Testy", "available")).petID;
    petForVaccinationID = (await makePet("Journey Vax Testy", "adopted")).petID;

    adopter = await registerAndLoginAdopter("Journey Test Adopter");
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { adopterID: adopter.userID } });
    await prisma.visit.deleteMany({ where: { adopterID: adopter.userID } });
    await prisma.vaccinationRecord.deleteMany({ where: { petID: petForVaccinationID } });
    await prisma.vaccine.deleteMany({ where: { vaccineName: { startsWith: "JourneyVax-" } } });
    await prisma.adoptionApplication.deleteMany({ where: { adopterID: adopter.userID } });
    await prisma.adopter.deleteMany({ where: { userID: adopter.userID } });
    await prisma.users.deleteMany({ where: { userID: adopter.userID } });
    await prisma.pet.deleteMany({
      where: {
        petID: {
          in: [petForAppID, petForVisitID, petForFavoriteID, petForVaccinationID],
        },
      },
    });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.shelter.deleteMany({ where: { shelterID } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("profile update round trip: PUT /adopters/me -> GET /adopters/me -> changes persisted", async () => {
    const putRes = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({ adopterName: "Journey Updated Name", city: "Journeyville", housingType: "House" });
    expect(putRes.status).toBe(200);

    // A fresh, independent read — not the PUT response — is the actual proof
    // the change persisted rather than just echoing back what was sent.
    const getRes = await request(app)
      .get("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${adopter.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.adopterName).toBe("Journey Updated Name");
    expect(getRes.body.data.city).toBe("Journeyville");
    expect(getRes.body.data.housingType).toBe("House");
  });

  // ——————————————————————————————————————————————————————————————
  test("full application journey: POST /adoption-applications -> Stripe webhook -> GET /adopters/me/applications shows status=Pending", async () => {
    const shelterMessage = "Journey test application message";

    // 1. Start checkout — this is all POST /adoption-applications ever does;
    // no row exists yet.
    const postRes = await request(app)
      .post("/api/v1/adoption-applications")
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({
        petID: petForAppID,
        shelterID,
        applicationType: "Adopt",
        shelterMessage,
      });
    expect(postRes.status).toBe(201);
    expect(postRes.body.data.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const [, sessionId] = postRes.body.data.checkoutUrl.match(/\/pay\/(cs_test_[^#?]+)/) || [];
    expect(sessionId).toBeTruthy();

    // 2. Simulate Stripe confirming payment on that *same real* Checkout
    // Session — a locally-signed checkout.session.completed event, verified
    // by the app's own webhook handler exactly as Stripe's would be.
    const session = {
      id: sessionId,
      object: "checkout.session",
      payment_status: "paid",
      payment_intent: `pi_test_journey_${Date.now()}`,
      metadata: {
        petID: String(petForAppID),
        adopterID: String(adopter.userID),
        shelterID: String(shelterID),
        applicationType: "Adopt",
        shelterMessage,
      },
    };
    const event = {
      id: `evt_test_journey_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: session },
    };
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const webhookRes = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature)
      .send(payload);
    expect(webhookRes.status).toBe(200);

    // 3. The row now exists, Pending, and shows up in the adopter's list.
    const listRes = await request(app)
      .get("/api/v1/adopters/me/applications")
      .query({ petID: petForAppID })
      .set("Authorization", `Bearer ${adopter.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].applicationStatus).toBe("Pending");
    expect(listRes.body.data[0].pet.petName).toBe("Journey App Testy");
  });

  // ——————————————————————————————————————————————————————————————
  test("visit scheduling round trip: POST /visits -> GET /adopters/me/visits -> visit appears", async () => {
    const visitTime = daysFromNow(7).toISOString();

    const postRes = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({ shelterID, petID: petForVisitID, visitTime, remarks: "Journey test visit" });
    expect(postRes.status).toBe(201);
    const visitID = postRes.body.data.visitID;

    const getRes = await request(app)
      .get("/api/v1/adopters/me/visits")
      .set("Authorization", `Bearer ${adopter.token}`);

    expect(getRes.status).toBe(200);
    const created = getRes.body.data.find((v) => v.visitID === visitID);
    expect(created).toBeDefined();
    expect(created.pet.petName).toBe("Journey Visit Testy");
    expect(created.remarks).toBe("Journey test visit");
  });

  // ——————————————————————————————————————————————————————————————
  test("favorites round trip: POST favorite -> GET favorites -> DELETE favorite -> GET favorites empty", async () => {
    const postRes = await request(app)
      .post(`/api/v1/pets/${petForFavoriteID}/favorites`)
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(postRes.status).toBe(201);

    const afterAdd = await request(app)
      .get("/api/v1/adopters/me/favorites")
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(afterAdd.status).toBe(200);
    expect(afterAdd.body.data.map((p) => p.petID)).toContain(petForFavoriteID);

    const deleteRes = await request(app)
      .delete(`/api/v1/pets/${petForFavoriteID}/favorites`)
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(deleteRes.status).toBe(200);

    const afterRemove = await request(app)
      .get("/api/v1/adopters/me/favorites")
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(afterRemove.status).toBe(200);
    expect(afterRemove.body.data).toEqual([]);
  });

  // ——————————————————————————————————————————————————————————————
  test("vaccination history round trip: seed adopted pet + vaccination records -> GET vaccinations -> correct records returned", async () => {
    const application = await prisma.adoptionApplication.create({
      data: {
        adopterID: adopter.userID,
        petID: petForVaccinationID,
        shelterID,
        applicationStatus: "Accepted",
        stripeCheckoutSessionID: `cs_test_fake_vax_journey_${adopter.userID}`,
      },
    });

    const vaccine1 = await prisma.vaccine.create({
      data: { vaccineName: "JourneyVax-Rabies" },
    });
    const vaccine2 = await prisma.vaccine.create({
      data: { vaccineName: "JourneyVax-DHPP" },
    });
    const record1 = await prisma.vaccinationRecord.create({
      data: {
        petID: petForVaccinationID,
        vaccineID: vaccine1.vaccineID,
        administeredDate: new Date("2025-01-01"),
        dueDate: new Date("2026-01-01"),
      },
    });
    const record2 = await prisma.vaccinationRecord.create({
      data: {
        petID: petForVaccinationID,
        vaccineID: vaccine2.vaccineID,
        administeredDate: new Date("2025-02-01"),
        dueDate: new Date("2026-02-01"),
      },
    });

    const res = await request(app)
      .get(`/api/v1/adopters/me/adopted-pets/${petForVaccinationID}/vaccinations`)
      .set("Authorization", `Bearer ${adopter.token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((r) => r.vaccineName).sort();
    expect(names).toEqual(["JourneyVax-DHPP", "JourneyVax-Rabies"]);
    expect(res.body.data.map((r) => r.recordID).sort()).toEqual(
      [record1.recordID, record2.recordID].sort(),
    );

    await prisma.vaccinationRecord.deleteMany({
      where: { recordID: { in: [record1.recordID, record2.recordID] } },
    });
    await prisma.vaccine.deleteMany({
      where: { vaccineID: { in: [vaccine1.vaccineID, vaccine2.vaccineID] } },
    });
    await prisma.adoptionApplication.delete({
      where: { applicationID: application.applicationID },
    });
  });
});
