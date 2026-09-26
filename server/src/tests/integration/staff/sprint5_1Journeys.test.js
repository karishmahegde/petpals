// Full request-response cycle tests for the core Sprint 5.1 Staff journeys —
// each test chains multiple real HTTP calls (plus a real Supabase Storage
// round trip for the file-upload steps) against the live test database,
// rather than exercising one endpoint/case in isolation the way the unit
// suites in src/tests/unit/staff/ do. Same conventions as
// integration/admin/adminJourneys.test.js: registerAndLoginActiveStaff force-
// activates a normally-Pending Staff registration directly via Prisma (this
// suite doesn't test the approval flow itself — that's covered elsewhere),
// and every test cleans up its own rows at the end, respecting FK order.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");

// Chained register/login/HTTP round trips, plus real Storage uploads (photo,
// government ID) on top of that — the 5s Jest default is too tight.
jest.setTimeout(60000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const login = (email, password) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

// Staff start Pending (PENDING_GATED_ROLES in auth.service.js) — force
// Active (plus any caller-supplied overrides, e.g. shelterID) directly via
// Prisma so these journeys can log in as the staff member and drive
// everything through their own token, the same shortcut
// adminJourneys.test.js takes for the pieces it doesn't mean to test.
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
  const loginRes = await login(payload.email, payload.password);
  return { userID, email: payload.email, token: loginRes.body.data.token };
};

const registerAdopter = async (name) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "adopter" };
  const res = await request(app).post("/api/v1/auth/register").send(payload);
  return { userID: res.body.data.userID };
};

const makeShelterPayload = (label, zip) => ({
  shelterName: `${label} ${Date.now()}`,
  shelterAddress: "1 Test Way",
  shelterPhone: "555-0100",
  shelterEmail: `${label.replace(/\s+/g, "").toLowerCase()}${Date.now()}@ex.com`,
  shelterZIP: zip,
  shelterSize: 10,
});

const VALID_PET_BODY = (breedID) => ({
  breedID,
  petName: `Journey Pet ${Date.now()}`,
  petDOB: "2021-01-01",
  petSex: "M",
  petColor: "Brown",
  petSize: "Medium",
  intakeDate: "2024-06-01",
  petWeight: 12.5,
  petHeight: 40,
});

// Directly seeds a Pending application — the actual create flow (Stripe
// Checkout + webhook) is a separate, already-covered integration path
// (integration/adopter/adoptionApplications.test.js); "seed a Pending
// application" here means exactly that, not re-driving payment.
const seedPendingApplication = ({ adopterID, petID, shelterID }) =>
  prisma.adoptionApplication.create({
    data: {
      adopterID,
      petID,
      shelterID,
      applicationType: "Adopt",
      applicationStatus: "Pending",
      stripeCheckoutSessionID: `cs_test_fake_s51_${petID}_${Date.now()}_${Math.random()}`,
    },
  });

describe("Sprint 5.1 Staff journeys", () => {
  let speciesID;
  let breedID;

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `S51JourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;

    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "S51JourneyBreed" },
    });
    breedID = breed.breedID;
  });

  afterAll(async () => {
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("full staff onboarding: PUT /staff/me -> POST /staff/me/government-id -> GET /staff/me and GET .../government-id reflect both", async () => {
    const shelter = await prisma.shelter.create({
      data: makeShelterPayload("Onboarding Shelter", 10001),
    });
    const staff = await registerAndLoginActiveStaff("Onboarding Journey Staff", {
      shelterID: shelter.shelterID,
    });

    const putRes = await request(app)
      .put("/api/v1/staff/me")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ staffName: "Onboarded Staffer", staffPhone: "+12125550199" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.staffName).toBe("Onboarded Staffer");

    const govIdRes = await request(app)
      .post("/api/v1/staff/me/government-id")
      .set("Authorization", `Bearer ${staff.token}`)
      .field("idType", "Passport")
      .field("idNumber", "S51JOURNEY123")
      .attach("file", Buffer.from("fake-id-scan-bytes"), {
        filename: "id.jpg",
        contentType: "image/jpeg",
      });
    expect(govIdRes.status).toBe(201);
    expect(govIdRes.body.data.verificationStatus).toBe("Pending");

    const profileRes = await request(app)
      .get("/api/v1/staff/me")
      .set("Authorization", `Bearer ${staff.token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.staffName).toBe("Onboarded Staffer");
    expect(profileRes.body.data.staffPhone).toBe("+12125550199");

    const govIdGetRes = await request(app)
      .get("/api/v1/staff/me/government-id")
      .set("Authorization", `Bearer ${staff.token}`);
    expect(govIdGetRes.status).toBe(200);
    expect(govIdGetRes.body.data.idType).toBe("Passport");
    // Masked — only the last 4 characters ever leave the API.
    expect(govIdGetRes.body.data.idNumber).toBe("*********Y123");

    await storage
      .deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, govIdRes.body.data.documentURL)
      .catch(() => {});
    await prisma.governmentID.deleteMany({ where: { userID: staff.userID } });
    await prisma.staff.deleteMany({ where: { userID: staff.userID } });
    await prisma.users.deleteMany({ where: { userID: staff.userID } });
    await prisma.shelter.deleteMany({ where: { shelterID: shelter.shelterID } });
  });

  // ——————————————————————————————————————————————————————————————
  test("full pet lifecycle: POST /pets -> PUT /pets/:id -> POST /pets/:id/photos -> public GET /pets/:id reflects it", async () => {
    const shelter = await prisma.shelter.create({
      data: makeShelterPayload("Pet Lifecycle Shelter", 10001),
    });
    const staff = await registerAndLoginActiveStaff("Pet Lifecycle Staff", {
      shelterID: shelter.shelterID,
    });

    const createRes = await request(app)
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${staff.token}`)
      .send(VALID_PET_BODY(breedID));
    expect(createRes.status).toBe(201);
    const petID = createRes.body.data.petID;
    expect(createRes.body.data.shelter.shelterID).toBe(shelter.shelterID);
    // Still points at the create-time placeholder object, just resolved to
    // a full URL now (toPublicFileUrl doesn't special-case it — only a
    // real upload replaces it, asserted after the photo step below).
    expect(createRes.body.data.petPhoto).toContain("placeholder.jpg");

    const updateRes = await request(app)
      .put(`/api/v1/pets/${petID}`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ petColor: "Golden", petWeight: 15 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.petColor).toBe("Golden");
    expect(updateRes.body.data.petWeight).toBe(15);

    const photoRes = await request(app)
      .post(`/api/v1/pets/${petID}/photos`)
      .set("Authorization", `Bearer ${staff.token}`)
      .attach("file", Buffer.from("fake-pet-photo-bytes"), {
        filename: "pet.jpg",
        contentType: "image/jpeg",
      });
    expect(photoRes.status).toBe(201);
    expect(photoRes.body.data).toHaveLength(1);
    expect(photoRes.body.data[0].isPrimary).toBe(true);

    const publicRes = await request(app).get(`/api/v1/pets/${petID}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.petColor).toBe("Golden");
    expect(publicRes.body.data.petWeight).toBe(15);
    // First photo ever uploaded -> becomes the pet's primary petPhoto, now a
    // real public Storage URL instead of the create-time placeholder.
    expect(publicRes.body.data.petPhoto).toMatch(/^https?:\/\//);
    expect(publicRes.body.data.petPhoto).not.toContain("placeholder.jpg");

    await storage.deletePrivateFile(
      storage.PET_IMAGES_BUCKET,
      `pets/${petID}/${photoRes.body.data[0].photoURL.split("/").pop()}`,
    ).catch(() => {});
    await prisma.petPhoto.deleteMany({ where: { petID } });
    await prisma.pet.deleteMany({ where: { petID } });
    await prisma.staff.deleteMany({ where: { userID: staff.userID } });
    await prisma.users.deleteMany({ where: { userID: staff.userID } });
    await prisma.shelter.deleteMany({ where: { shelterID: shelter.shelterID } });
  });

  // ——————————————————————————————————————————————————————————————
  test("full application acceptance: seed Pending -> PATCH .../status=Accepted -> GET /pets/:id shows adoptionStatus=adopted", async () => {
    const shelter = await prisma.shelter.create({
      data: makeShelterPayload("Acceptance Shelter", 10001),
    });
    const staff = await registerAndLoginActiveStaff("Acceptance Journey Staff", {
      shelterID: shelter.shelterID,
    });
    const adopter = await registerAdopter("Acceptance Journey Adopter");

    const pet = await prisma.pet.create({
      data: {
        breedID,
        shelterID: shelter.shelterID,
        petName: "Acceptance Pet",
        petDOB: new Date("2021-01-01"),
        petSex: "M",
        petColor: "Brown",
        petSize: "Medium",
        petBGroup: "N/A",
        petWeight: 10,
        petHeight: 10,
        intakeDate: new Date(),
        petPhoto: "placeholder.jpg",
        adoptionStatus: "available",
      },
    });

    const application = await seedPendingApplication({
      adopterID: adopter.userID,
      petID: pet.petID,
      shelterID: shelter.shelterID,
    });

    const acceptRes = await request(app)
      .patch(`/api/v1/adoption-applications/${application.applicationID}/status`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ status: "Accepted", staffRemark: "Great match" });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.applicationStatus).toBe("Accepted");

    const petRes = await request(app).get(`/api/v1/pets/${pet.petID}`);
    expect(petRes.status).toBe(200);
    expect(petRes.body.data.adoptionStatus).toBe("adopted");

    await prisma.adoptionApplication.deleteMany({
      where: { applicationID: application.applicationID },
    });
    await prisma.pet.deleteMany({ where: { petID: pet.petID } });
    await prisma.adopter.deleteMany({ where: { userID: adopter.userID } });
    await prisma.users.deleteMany({ where: { userID: adopter.userID } });
    await prisma.staff.deleteMany({ where: { userID: staff.userID } });
    await prisma.users.deleteMany({ where: { userID: staff.userID } });
    await prisma.shelter.deleteMany({ where: { shelterID: shelter.shelterID } });
  });

  // ——————————————————————————————————————————————————————————————
  test("cross-shelter isolation: a second shelter's staff can't see or act on the first shelter's pets/applications", async () => {
    const shelterA = await prisma.shelter.create({
      data: makeShelterPayload("Isolation Shelter A", 10001),
    });
    const shelterB = await prisma.shelter.create({
      data: makeShelterPayload("Isolation Shelter B", 11201),
    });
    const staffA = await registerAndLoginActiveStaff("Isolation Staff A", {
      shelterID: shelterA.shelterID,
    });
    const staffB = await registerAndLoginActiveStaff("Isolation Staff B", {
      shelterID: shelterB.shelterID,
    });
    const adopter = await registerAdopter("Isolation Journey Adopter");

    // Staff A creates a pet at their own shelter.
    const createRes = await request(app)
      .post("/api/v1/pets")
      .set("Authorization", `Bearer ${staffA.token}`)
      .send(VALID_PET_BODY(breedID));
    expect(createRes.status).toBe(201);
    const petID = createRes.body.data.petID;

    const application = await seedPendingApplication({
      adopterID: adopter.userID,
      petID,
      shelterID: shelterA.shelterID,
    });

    // Staff B's own shelter-scoped pet list never includes Shelter A's pet.
    const petsListRes = await request(app)
      .get("/api/v1/staff/me/pets")
      .set("Authorization", `Bearer ${staffB.token}`);
    expect(petsListRes.status).toBe(200);
    expect(petsListRes.body.data.map((p) => p.petID)).not.toContain(petID);

    // Staff B can't edit or delete Shelter A's pet directly either.
    const editRes = await request(app)
      .put(`/api/v1/pets/${petID}`)
      .set("Authorization", `Bearer ${staffB.token}`)
      .send({ petColor: "Hijacked" });
    expect(editRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/v1/pets/${petID}`)
      .set("Authorization", `Bearer ${staffB.token}`);
    expect(deleteRes.status).toBe(403);

    // Staff B's application queue never includes Shelter A's application.
    const appsListRes = await request(app)
      .get("/api/v1/adoption-applications?section=active")
      .set("Authorization", `Bearer ${staffB.token}`);
    expect(appsListRes.status).toBe(200);
    expect(
      appsListRes.body.data.map((a) => a.applicationID),
    ).not.toContain(application.applicationID);

    // Staff B can't act on Shelter A's application either.
    const reviewRes = await request(app)
      .patch(`/api/v1/adoption-applications/${application.applicationID}/status`)
      .set("Authorization", `Bearer ${staffB.token}`)
      .send({ status: "Accepted" });
    expect(reviewRes.status).toBe(403);

    // Confirm nothing actually changed despite the blocked attempts.
    const petCheck = await prisma.pet.findUnique({ where: { petID } });
    expect(petCheck.petColor).not.toBe("Hijacked");
    expect(petCheck.adoptionStatus).toBe("incoming");
    const appCheck = await prisma.adoptionApplication.findUnique({
      where: { applicationID: application.applicationID },
    });
    expect(appCheck.applicationStatus).toBe("Pending");

    await prisma.adoptionApplication.deleteMany({
      where: { applicationID: application.applicationID },
    });
    await prisma.pet.deleteMany({ where: { petID } });
    await prisma.adopter.deleteMany({ where: { userID: adopter.userID } });
    await prisma.users.deleteMany({ where: { userID: adopter.userID } });
    await prisma.staff.deleteMany({
      where: { userID: { in: [staffA.userID, staffB.userID] } },
    });
    await prisma.users.deleteMany({
      where: { userID: { in: [staffA.userID, staffB.userID] } },
    });
    await prisma.shelter.deleteMany({
      where: { shelterID: { in: [shelterA.shelterID, shelterB.shelterID] } },
    });
  });
});
