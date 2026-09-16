// Full request-response cycle tests for the core Admin oversight journeys —
// each test chains multiple real HTTP calls against the live test database
// (the same DATABASE_URL as every other integration test here), rather than
// exercising one endpoint/case in isolation the way the unit suites in
// src/tests/unit/admin/ do. Some overlap with those suites is expected and
// fine: the point of a journey test is proving the *chain* works end to end,
// not finding new edge cases.
//
// Two corrections versus the original ticket, both verified against the
// current schema/service code before writing these:
//   1. Adopters have no "Pending" accountStatus — AdopterAccountStatus is
//      Active/Banned/Deactivated only (see schema.prisma). Pending-gated
//      self-registration (PENDING_GATED_ROLES in auth.service.js) applies to
//      Admin/Staff/Vet only. The adopter-moderation journey below seeds a
//      normal Active adopter instead.
//   2. GET /analytics/overview aggregates org-wide with no `where` scoping
//      at all (see analytics.service.js's getOverview — four unscoped
//      groupBy queries) — it isn't just this suite's data, it's every row in
//      the shared dev DB. "Totals match exactly" is therefore asserted as a
//      before/after delta against an observed baseline, not a hardcoded
//      absolute value; adoptionRate is checked against a value recomputed
//      from that same baseline + the known seeded delta, not guessed.
//
// The adopter-moderation journey also deliberately does NOT re-assert
// "banned adopter can't log in" — that's already covered by
// auth.login.test.js's "blocked adopter accountStatus" suite (seeded
// directly via Prisma there). What's new here, and only here, is driving the
// ban through the real admin endpoint (PATCH /adopters/:id/status) and
// confirming an access token issued *before* the ban is rejected immediately
// on its next use, not just that a fresh login attempt fails afterward.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Chained register/login/HTTP round trips (several per journey) against the
// remote Supabase instance can exceed Jest's 5s default.
jest.setTimeout(20000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

// Registers a plain adopter (accountStatus starts Active — adopters are
// never Pending) without logging in; callers log in explicitly if they need
// a token.
const registerAdopter = async (name) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "adopter" };
  const res = await request(app).post("/api/v1/auth/register").send(payload);
  return { userID: res.body.data.userID, email: payload.email, password: payload.password };
};

const login = (email, password) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

// Every Admin after the very first ever created auto-activates as Pending
// (see PENDING_GATED_ROLES in auth.service.js) — this suite can't assume
// whether an Admin already exists in the shared dev DB, so force Active
// directly rather than depending on the bootstrap-first-admin exception.
const registerAndLoginActiveAdmin = async (name) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "admin" };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  const userID = registerRes.body.data.userID;
  await prisma.admin.update({ where: { userID }, data: { accountStatus: "Active" } });
  const loginRes = await login(payload.email, payload.password);
  return { userID, token: loginRes.body.data.token };
};

// Staff also start Pending; these journeys drive staff purely through the
// Admin API, never logging in as the staff member itself, so only Active
// (plus any caller-supplied overrides) needs forcing directly.
const registerActiveStaff = async (name, overrides = {}) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "staff" };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  const userID = registerRes.body.data.userID;
  await prisma.staff.update({
    where: { userID },
    data: { accountStatus: "Active", ...overrides },
  });
  return { userID, name };
};

const makeShelterPayload = (label, zip) => ({
  shelterName: `${label} ${Date.now()}`,
  shelterAddress: "1 Test Way",
  shelterPhone: "555-0100",
  shelterEmail: `${label.replace(/\s+/g, "").toLowerCase()}${Date.now()}@ex.com`,
  shelterZIP: zip,
  shelterSize: 10,
});

describe("Admin oversight journeys", () => {
  let speciesID;
  let breedID;
  let admin;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `AdminJourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "AdminJourneyBreed" },
    });
    breedID = breed.breedID;

    admin = await registerAndLoginActiveAdmin("Admin Journey Admin");
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({ where: { userID: admin.userID } });
    await prisma.users.deleteMany({ where: { userID: admin.userID } });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("full shelter lifecycle: POST /shelters -> PATCH .../status -> PATCH .../manager -> GET /analytics/shelters reflects it", async () => {
    const createRes = await request(app)
      .post("/api/v1/shelters")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        shelterName: `Lifecycle Shelter ${Date.now()}`,
        shelterAddress: "1 Lifecycle Way",
        shelterPhone: "+12125550105",
        shelterEmail: `lifecycle${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 25,
      });
    expect(createRes.status).toBe(201);
    const shelterID = createRes.body.data.shelterID;
    expect(createRes.body.data.shelterStatus).toBe("Open");
    expect(createRes.body.data.lat).toEqual(expect.any(Number));
    expect(createRes.body.data.lng).toEqual(expect.any(Number));

    const statusRes = await request(app)
      .patch(`/api/v1/shelters/${shelterID}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ shelterStatus: "Full" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.shelterStatus).toBe("Full");

    const manager = await registerActiveStaff("Lifecycle Manager", { shelterID });

    const managerRes = await request(app)
      .patch(`/api/v1/shelters/${shelterID}/manager`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ managerStaffID: manager.userID });
    expect(managerRes.status).toBe(200);
    expect(managerRes.body.data.managerStaffID).toBe(manager.userID);

    const analyticsRes = await request(app)
      .get("/api/v1/analytics/shelters")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(analyticsRes.status).toBe(200);

    const entry = analyticsRes.body.data.find((s) => s.shelterID === shelterID);
    expect(entry).toBeDefined();
    expect(entry.shelterStatus).toBe("Full");
    expect(entry.managerStaffID).toBe(manager.userID);
    expect(entry.managerName).toBe("Lifecycle Manager");

    // Clear the cross-reference before deleting either side — Shelter and
    // Staff FK each other (managerStaffID / shelterID).
    await prisma.shelter.update({ where: { shelterID }, data: { managerStaffID: null } });
    await prisma.staff.deleteMany({ where: { userID: manager.userID } });
    await prisma.users.deleteMany({ where: { userID: manager.userID } });
    await prisma.shelter.deleteMany({ where: { shelterID } });
  });

  // ——————————————————————————————————————————————————————————————
  test("full staff reassignment: PATCH /staff/:id (shelterID change) -> GET /staff/:id confirms new shelter, old shelter's manager cleared", async () => {
    const shelterA = await prisma.shelter.create({
      data: makeShelterPayload("Reassign Shelter A", 10001),
    });
    const shelterB = await prisma.shelter.create({
      data: makeShelterPayload("Reassign Shelter B", 11201),
    });

    const staffMember = await registerActiveStaff("Reassign Test Staff", {
      shelterID: shelterA.shelterID,
      staffDesignation: "Manager",
    });
    // Mirrors the invariant PATCH /staff/:id itself maintains (a Manager's
    // shelter points back at them) so "old shelter cleared" below is
    // actually testing something, not a no-op on an already-null field.
    await prisma.shelter.update({
      where: { shelterID: shelterA.shelterID },
      data: { managerStaffID: staffMember.userID },
    });

    const patchRes = await request(app)
      .patch(`/api/v1/staff/${staffMember.userID}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ shelterID: shelterB.shelterID });
    expect(patchRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/staff/${staffMember.userID}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.shelterID).toBe(shelterB.shelterID);
    // Still a Manager, just moved — they should now manage the NEW shelter
    // only, not the old one.
    expect(getRes.body.data.managedShelters.map((s) => s.shelterID)).toEqual([
      shelterB.shelterID,
    ]);

    const oldShelter = await prisma.shelter.findUnique({
      where: { shelterID: shelterA.shelterID },
    });
    expect(oldShelter.managerStaffID).toBeNull();

    await prisma.shelter.updateMany({
      where: { shelterID: { in: [shelterA.shelterID, shelterB.shelterID] } },
      data: { managerStaffID: null },
    });
    await prisma.staff.deleteMany({ where: { userID: staffMember.userID } });
    await prisma.users.deleteMany({ where: { userID: staffMember.userID } });
    await prisma.shelter.deleteMany({
      where: { shelterID: { in: [shelterA.shelterID, shelterB.shelterID] } },
    });
  });

  // ——————————————————————————————————————————————————————————————
  test("full adopter moderation: PATCH /adopters/:id/status=Banned invalidates an already-issued access token immediately", async () => {
    const seed = await registerAdopter("Moderation Test Adopter");

    // Precondition, not the assertion under test — needed to mint a token
    // issued BEFORE the ban.
    const preBanLogin = await login(seed.email, seed.password);
    const preBanToken = preBanLogin.body.data.token;

    const banRes = await request(app)
      .patch(`/api/v1/adopters/${seed.userID}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ accountStatus: "Banned" });
    expect(banRes.status).toBe(200);
    expect(banRes.body.data.accountStatus).toBe("Banned");

    // The interesting part: this token was valid seconds ago and hasn't
    // expired — only the live accountStatus check in authenticate.js stops
    // it, not token expiry or a fresh login rejection (already covered in
    // auth.login.test.js).
    const meRes = await request(app)
      .get("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${preBanToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe("UNAUTHORIZED");

    await prisma.adopter.deleteMany({ where: { userID: seed.userID } });
    await prisma.users.deleteMany({ where: { userID: seed.userID } });
  });

  // ——————————————————————————————————————————————————————————————
  test("analytics consistency: seed known pets/applications counts -> GET /analytics/overview totals move by exactly that amount", async () => {
    const before = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(before.status).toBe(200);

    const shelter = await prisma.shelter.create({
      data: makeShelterPayload("Analytics Shelter", 10001),
    });
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
      shelterID: shelter.shelterID,
    };
    const makePet = (petName, adoptionStatus) =>
      prisma.pet.create({ data: { ...petData, petName, adoptionStatus } });

    // Exactly 2 "available" + 1 "adopted" pets seeded.
    const petA = await makePet("Analytics Pet A", "available");
    const petB = await makePet("Analytics Pet B", "available");
    const petC = await makePet("Analytics Pet C", "adopted");

    const adopter = await registerAdopter("Analytics Test Adopter");
    const seedApplication = (petID, applicationStatus) =>
      prisma.adoptionApplication.create({
        data: {
          adopterID: adopter.userID,
          petID,
          shelterID: shelter.shelterID,
          applicationType: "Adopt",
          applicationStatus,
          stripeCheckoutSessionID: `cs_test_fake_analytics_${petID}_${Date.now()}_${Math.random()}`,
        },
      });

    // Exactly 2 Accepted + 1 Pending applications seeded.
    const app1 = await seedApplication(petA.petID, "Accepted");
    const app2 = await seedApplication(petB.petID, "Accepted");
    const app3 = await seedApplication(petC.petID, "Pending");

    const after = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(after.status).toBe(200);

    expect(after.body.data.pets.total - before.body.data.pets.total).toBe(3);
    const beforeAvailable = before.body.data.pets.byStatus.available ?? 0;
    const beforeAdopted = before.body.data.pets.byStatus.adopted ?? 0;
    expect(after.body.data.pets.byStatus.available).toBe(beforeAvailable + 2);
    expect(after.body.data.pets.byStatus.adopted).toBe(beforeAdopted + 1);

    expect(
      after.body.data.applications.total - before.body.data.applications.total,
    ).toBe(3);
    const beforeAccepted = before.body.data.applications.byStatus.Accepted ?? 0;
    const beforePending = before.body.data.applications.byStatus.Pending ?? 0;
    expect(after.body.data.applications.byStatus.Accepted).toBe(beforeAccepted + 2);
    expect(after.body.data.applications.byStatus.Pending).toBe(beforePending + 1);

    // adoptionRate recomputed from the observed baseline + the known seeded
    // delta — this endpoint aggregates org-wide with no scoping, so an
    // absolute value can't be hardcoded against a shared, non-isolated DB.
    const expectedTotal = before.body.data.applications.total + 3;
    const expectedAccepted = beforeAccepted + 2;
    const expectedRate = Math.round((expectedAccepted / expectedTotal) * 100) / 100;
    expect(after.body.data.applications.adoptionRate).toBe(expectedRate);

    await prisma.adoptionApplication.deleteMany({
      where: {
        applicationID: {
          in: [app1.applicationID, app2.applicationID, app3.applicationID],
        },
      },
    });
    await prisma.adopter.deleteMany({ where: { userID: adopter.userID } });
    await prisma.users.deleteMany({ where: { userID: adopter.userID } });
    await prisma.pet.deleteMany({
      where: { petID: { in: [petA.petID, petB.petID, petC.petID] } },
    });
    await prisma.shelter.deleteMany({ where: { shelterID: shelter.shelterID } });
  });
});
