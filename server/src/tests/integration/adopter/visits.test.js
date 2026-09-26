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

// Staff start Pending (PENDING_GATED_ROLES in auth.service.js) — force
// Active (plus any caller-supplied overrides, e.g. shelterID) directly via
// Prisma, same shortcut integration/staff/sprint5_1Journeys.test.js takes.
// Staff sign-up requires picking a shelter (auth.service.js register()), so
// overrides.shelterID doubles as the one they register at — every caller
// passes one.
const registerAndLoginActiveStaff = async (name, overrides = {}) => {
  const payload = {
    name,
    email: uniqueEmail(),
    password: "Secret123!",
    role: "staff",
    shelterID: overrides.shelterID,
  };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  expect(registerRes.status).toBe(201);
  const userID = registerRes.body.data.userID;
  await prisma.staff.update({
    where: { userID },
    data: { accountStatus: "Active", ...overrides },
  });
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

// Every Admin after the very first ever created auto-activates as Pending —
// force Active directly, same shortcut integration/admin/adminJourneys.test.js takes.
const registerAndLoginActiveAdmin = async (name) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "admin" };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  const userID = registerRes.body.data.userID;
  await prisma.admin.update({ where: { userID }, data: { accountStatus: "Active" } });
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("visits", () => {
  let speciesID;
  let breedID;
  let shelterID;
  let otherShelterID;
  let petID;
  let adopterA;
  let adopterB;
  let staffAtShelter;
  let staffAtOtherShelter;
  let admin;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `VisitTestSpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "VisitTestBreed" },
    });
    breedID = breed.breedID;

    const shelter = await prisma.shelter.create({
      data: {
        shelterName: "Visit Test Shelter",
        shelterAddress: "1 Test Way",
        shelterPhone: "555-0100",
        shelterEmail: `shelter${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 10,
      },
    });
    shelterID = shelter.shelterID;

    const otherShelter = await prisma.shelter.create({
      data: {
        shelterName: "Other Visit Test Shelter",
        shelterAddress: "2 Test Way",
        shelterPhone: "555-0101",
        shelterEmail: `othershelter${Date.now()}@ex.com`,
        shelterZIP: 10002,
        shelterSize: 10,
      },
    });
    otherShelterID = otherShelter.shelterID;

    const pet = await prisma.pet.create({
      data: {
        petName: "Visit Testy",
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
        adoptionStatus: "available",
      },
    });
    petID = pet.petID;

    adopterA = await registerAndLoginAdopter("Visit Test Adopter A");
    adopterB = await registerAndLoginAdopter("Visit Test Adopter B");
    staffAtShelter = await registerAndLoginActiveStaff("Visit Test Staff", { shelterID });
    staffAtOtherShelter = await registerAndLoginActiveStaff("Visit Test Other Staff", {
      shelterID: otherShelterID,
    });
    admin = await registerAndLoginActiveAdmin("Visit Test Admin");
  });

  afterAll(async () => {
    // Safety net — every test below also cleans up the rows it creates.
    await prisma.visit.deleteMany({
      where: { adopterID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.adopter.deleteMany({
      where: { userID: { in: [adopterA.userID, adopterB.userID] } },
    });
    await prisma.staff.deleteMany({
      where: { userID: { in: [staffAtShelter.userID, staffAtOtherShelter.userID] } },
    });
    await prisma.admin.deleteMany({ where: { userID: admin.userID } });
    await prisma.users.deleteMany({
      where: {
        userID: {
          in: [
            adopterA.userID,
            adopterB.userID,
            staffAtShelter.userID,
            staffAtOtherShelter.userID,
            admin.userID,
          ],
        },
      },
    });
    await prisma.pet.deleteMany({ where: { petID } });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: [shelterID, otherShelterID] } } });
    await prisma.$disconnect();
  });

  // ——————————————————— POST /visits ———————————————————
  describe("POST /api/v1/visits", () => {
    test("valid payload -> 201, visit created", async () => {
      const visitTime = daysFromNow(5).toISOString();

      const res = await request(app)
        .post("/api/v1/visits")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({ shelterID, petID, visitTime, remarks: "Looking forward to it" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.adopterID).toBe(adopterA.userID);
      expect(res.body.data.shelterID).toBe(shelterID);
      expect(res.body.data.petID).toBe(petID);
      expect(res.body.data.remarks).toBe("Looking forward to it");
      expect(res.body.data.visitStatus).toBeNull(); // unconfirmed until staff acts

      const visit = await prisma.visit.findUnique({
        where: { visitID: res.body.data.visitID },
      });
      expect(visit).not.toBeNull();
      expect(visit.adopterID).toBe(adopterA.userID);

      await prisma.visit.delete({ where: { visitID: res.body.data.visitID } });
    });

    test("visitTime in the past -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .post("/api/v1/visits")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({ shelterID, visitTime: daysFromNow(-1).toISOString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    test("invalid shelterID -> 404 NOT_FOUND", async () => {
      const bogusShelterID = shelterID + 999999;

      const res = await request(app)
        .post("/api/v1/visits")
        .set("Authorization", `Bearer ${adopterA.token}`)
        .send({ shelterID: bogusShelterID, visitTime: daysFromNow(5).toISOString() });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    test("unauthenticated -> 401 UNAUTHORIZED", async () => {
      const res = await request(app)
        .post("/api/v1/visits")
        .send({ shelterID, visitTime: daysFromNow(5).toISOString() });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // ——————————————————— GET /adopters/me/visits ———————————————————
  describe("GET /api/v1/adopters/me/visits", () => {
    test("returns visits for this adopter only, ordered by visitTime ascending", async () => {
      // Deliberately created out of chronological order.
      const v2 = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(6) },
      });
      const v1 = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(2) },
      });
      const v3 = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(9) },
      });
      const otherAdopterVisit = await prisma.visit.create({
        data: { adopterID: adopterB.userID, shelterID, visitTime: daysFromNow(4) },
      });

      const res = await request(app)
        .get("/api/v1/adopters/me/visits")
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((v) => v.visitID);
      expect(ids).not.toContain(otherAdopterVisit.visitID);
      // Only this adopter's three, in ascending visitTime order: v1, v2, v3.
      expect(ids).toEqual([v1.visitID, v2.visitID, v3.visitID]);

      await prisma.visit.deleteMany({
        where: { visitID: { in: [v1.visitID, v2.visitID, v3.visitID, otherAdopterVisit.visitID] } },
      });
    });

    test("?upcoming=true -> only future visits returned", async () => {
      const future = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(3) },
      });
      const past = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(-3) },
      });

      const res = await request(app)
        .get("/api/v1/adopters/me/visits")
        .query({ upcoming: "true" })
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((v) => v.visitID);
      expect(ids).toContain(future.visitID);
      expect(ids).not.toContain(past.visitID);

      await prisma.visit.deleteMany({
        where: { visitID: { in: [future.visitID, past.visitID] } },
      });
    });
  });

  // ——————————————————— GET /api/v1/visits (staff queue) ———————————————————
  describe("GET /api/v1/visits", () => {
    test("Staff sees only their own shelter's visits, Admin sees all", async () => {
      const ownVisit = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(5) },
      });
      const otherShelterVisit = await prisma.visit.create({
        data: { adopterID: adopterB.userID, shelterID: otherShelterID, visitTime: daysFromNow(5) },
      });

      const staffRes = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${staffAtShelter.token}`);
      expect(staffRes.status).toBe(200);
      const staffIds = staffRes.body.data.map((v) => v.visitID);
      expect(staffIds).toContain(ownVisit.visitID);
      expect(staffIds).not.toContain(otherShelterVisit.visitID);

      const adminRes = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(adminRes.status).toBe(200);
      const adminIds = adminRes.body.data.map((v) => v.visitID);
      expect(adminIds).toContain(ownVisit.visitID);
      expect(adminIds).toContain(otherShelterVisit.visitID);

      await prisma.visit.deleteMany({
        where: { visitID: { in: [ownVisit.visitID, otherShelterVisit.visitID] } },
      });
    });

    test("?upcoming=true -> only future visits returned", async () => {
      const future = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(3) },
      });
      const past = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(-3) },
      });

      const res = await request(app)
        .get("/api/v1/visits")
        .query({ upcoming: "true" })
        .set("Authorization", `Bearer ${staffAtShelter.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((v) => v.visitID);
      expect(ids).toContain(future.visitID);
      expect(ids).not.toContain(past.visitID);

      await prisma.visit.deleteMany({
        where: { visitID: { in: [future.visitID, past.visitID] } },
      });
    });

    test("Adopter -> 403 FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${adopterA.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ——————————————————— PATCH /api/v1/visits/:id (staff transitions) ———————————————————
  describe("PATCH /api/v1/visits/:id (staff transitions)", () => {
    test("Staff confirms then completes their own shelter's visit; staffID set", async () => {
      const visit = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(2) },
      });

      const confirmRes = await request(app)
        .patch(`/api/v1/visits/${visit.visitID}`)
        .set("Authorization", `Bearer ${staffAtShelter.token}`)
        .send({ visitStatus: "Confirmed" });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.visitStatus).toBe("Confirmed");
      expect(confirmRes.body.data.staffID).toBe(staffAtShelter.userID);

      const completeRes = await request(app)
        .patch(`/api/v1/visits/${visit.visitID}`)
        .set("Authorization", `Bearer ${staffAtShelter.token}`)
        .send({ visitStatus: "Completed" });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.visitStatus).toBe("Completed");

      await prisma.visit.delete({ where: { visitID: visit.visitID } });
    });

    test("Staff at another shelter -> 403 FORBIDDEN", async () => {
      const visit = await prisma.visit.create({
        data: { adopterID: adopterA.userID, shelterID, visitTime: daysFromNow(2) },
      });

      const res = await request(app)
        .patch(`/api/v1/visits/${visit.visitID}`)
        .set("Authorization", `Bearer ${staffAtOtherShelter.token}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");

      await prisma.visit.delete({ where: { visitID: visit.visitID } });
    });

    test("Completing an already-Cancelled visit -> 409 CONFLICT", async () => {
      const visit = await prisma.visit.create({
        data: {
          adopterID: adopterA.userID,
          shelterID,
          visitTime: daysFromNow(2),
          visitStatus: "Cancelled",
        },
      });

      const res = await request(app)
        .patch(`/api/v1/visits/${visit.visitID}`)
        .set("Authorization", `Bearer ${staffAtShelter.token}`)
        .send({ visitStatus: "Completed" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");

      await prisma.visit.delete({ where: { visitID: visit.visitID } });
    });

    test("Admin confirms a visit at any shelter; staffID left null", async () => {
      const visit = await prisma.visit.create({
        data: { adopterID: adopterB.userID, shelterID: otherShelterID, visitTime: daysFromNow(2) },
      });

      const res = await request(app)
        .patch(`/api/v1/visits/${visit.visitID}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(200);
      expect(res.body.data.visitStatus).toBe("Confirmed");
      expect(res.body.data.staffID).toBeNull();

      await prisma.visit.delete({ where: { visitID: visit.visitID } });
    });
  });
});
