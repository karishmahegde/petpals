// Full request-response cycle tests for the Sprint 6 veterinarian journeys,
// against the live test database: a vet onboarding before approval, an
// appointment from staff booking to the vet completing it, and a dose that
// follows its pet across a transfer onto the new shelter's health passport.
// The unit suites (unit/vet/*, unit/auth/login, unit/staff/
// vets.management) cover each rule in isolation; these prove they fit
// together.
// Same conventions as staffOnboarding.journey.test.js: real sign-ups and
// HTTP calls; the supporting cast (shelter managers, the vets that aren't
// the subject of the onboarding journey) force-activated via Prisma since
// their approval is covered elsewhere; and everything removed in afterAll —
// users found by the generated emails, so a test that times out after the
// server created an account still gets cleaned up.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");

const createdEmails = [];
const uniqueEmail = () => {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;
  createdEmails.push(email);
  return email;
};

const PASSWORD = "Secret123!";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// The onboarding journey alone chains ~20 real round trips (sign-up,
// logins, a Storage upload, ID review) against the remote database — well
// past the 30s config default (jest.config.js). A timed-out test keeps
// running while afterAll deletes its data, so give it room rather than let
// the two race.
jest.setTimeout(120000);

const register = (name, email, role, shelterID) =>
  request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: PASSWORD, role, shelterID });

const login = (email) =>
  request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const makeShelter = (label, zip) =>
  prisma.shelter.create({
    data: {
      shelterName: `${label} ${Date.now()}`,
      shelterAddress: "1 Test Way",
      shelterPhone: "555-0100",
      shelterEmail: `${label.replace(/\s+/g, "").toLowerCase()}${Date.now()}@ex.com`,
      shelterZIP: zip,
      shelterSize: 10,
    },
  });

// The first sign-up at a manager-less shelter registers as its (Pending)
// Manager — activate them and link them as the shelter's manager, which a
// vet sign-up there requires.
const makeManager = async (shelter, name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "staff", shelter.shelterID);
  expect(res.status).toBe(201);
  const userID = res.body.data.userID;
  await prisma.staff.update({
    where: { userID },
    data: { accountStatus: "Active", staffDesignation: "Manager", onboardingComplete: true },
  });
  await prisma.shelter.update({
    where: { shelterID: shelter.shelterID },
    data: { managerStaffID: userID },
  });
  const loginRes = await login(email);
  return { userID, token: loginRes.body.data.token };
};

// A vet who isn't the subject of the onboarding journey — real sign-up,
// then force-approved.
const makeActiveVet = async (shelter, name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "vet", shelter.shelterID);
  expect(res.status).toBe(201);
  const userID = res.body.data.userID;
  await prisma.veterinarian.update({
    where: { userID },
    data: { accountStatus: "Active", onboardingComplete: true, onboardingStep: 5 },
  });
  const loginRes = await login(email);
  return { userID, token: loginRes.body.data.token };
};

describe("Sprint 6 veterinarian journeys", () => {
  let shelterA;
  let shelterB;
  let managerA;
  let managerB;
  let vetA;
  let vetB;
  let speciesID;
  let breedID;
  let vaccine;
  const petIDs = [];

  beforeAll(async () => {
    shelterA = await makeShelter("S6 Journey Shelter A", 10001);
    shelterB = await makeShelter("S6 Journey Shelter B", 10002);
    managerA = await makeManager(shelterA, "S6 Manager A");
    managerB = await makeManager(shelterB, "S6 Manager B");
    vetA = await makeActiveVet(shelterA, "S6 Vet A");
    vetB = await makeActiveVet(shelterB, "S6 Vet B");

    const species = await prisma.species.create({
      data: { speciesName: `S6JourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;
    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "S6JourneyBreed" },
    });
    breedID = breed.breedID;

    // The vaccine catalog is real API surface too — added by a vet.
    const vaccineRes = await request(app)
      .post("/api/v1/vaccines")
      .set(bearer(vetA.token))
      .send({
        vaccineName: `S6 Journey Rabies ${Date.now()}`,
        manufacturer: "Journey Labs",
        vaccineDesc: "Created by the Sprint 6 journey suite",
      });
    expect(vaccineRes.status).toBe(201);
    vaccine = vaccineRes.body.data;
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({
      where: { userEmail: { in: createdEmails } },
      select: { userID: true },
    });
    const userIDs = users.map((u) => u.userID);

    // Children before parents: doses/records/appointments/transfers FK the
    // pets (and vets/staff/shelters); pets FK staff, breed and shelter.
    await prisma.vaccinationRecord.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.healthRecord.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.appointment.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.transferHistory.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.petPhoto.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.pet.deleteMany({ where: { petID: { in: petIDs } } });
    if (vaccine) {
      await prisma.vaccine.deleteMany({ where: { vaccineID: vaccine.vaccineID } });
    }
    if (breedID) await prisma.breed.deleteMany({ where: { breedID } });
    if (speciesID) await prisma.species.deleteMany({ where: { speciesID } });

    const ids = await prisma.governmentID.findMany({
      where: { userID: { in: userIDs } },
      select: { documentURL: true },
    });
    await Promise.all(
      ids
        .filter((id) => id.documentURL)
        .map((id) => storage.deletePrivateFile(storage.GOVERNMENT_IDS_BUCKET, id.documentURL)),
    );
    await prisma.governmentID.deleteMany({ where: { userID: { in: userIDs } } });

    const shelterIDs = [shelterA, shelterB].filter(Boolean).map((s) => s.shelterID);
    // Shelter.managerStaffID → Staff and Staff.shelterID → Shelter point at
    // each other: unlink first, then vets/staff/users, then the shelters.
    await prisma.shelter.updateMany({
      where: { shelterID: { in: shelterIDs } },
      data: { managerStaffID: null },
    });
    await prisma.veterinarian.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.$disconnect();
  });

  // An available pet at the manager's shelter, created through the real
  // staff POST /pets.
  const createPet = async (manager, name) => {
    const res = await request(app)
      .post("/api/v1/pets")
      .set(bearer(manager.token))
      .send({
        breedID,
        petName: `${name} ${Date.now()}`,
        petDOB: "2021-01-01",
        petSex: "M",
        petColor: "Brown",
        petSize: "Medium",
        intakeDate: "2024-06-01",
        petWeight: 12.5,
        petHeight: 40,
        adoptionStatus: "available",
      });
    expect(res.status).toBe(201);
    petIDs.push(res.body.data.petID);
    return res.body.data;
  };

  // Staff books the vet — appointments can only be created in the future.
  const bookAppointment = async (manager, petID, vetID, reason) => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set(bearer(manager.token))
      .send({
        petID,
        vetID,
        appointmentDate: new Date(Date.now() + 2 * HOUR).toISOString(),
        appointmentReason: reason,
      });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  const recordDose = (vet, appointmentID, body) =>
    request(app)
      .post(`/api/v1/appointments/${appointmentID}/vaccinations`)
      .set(bearer(vet.token))
      .send(body);

  // ——————————————————————————————————————————————————————————————
  test("vet onboarding: register → Pending login → onboarding steps → government ID → manager verifies ID → manager approves → full login", async () => {
    // 1. Sign up at shelter A (which has a manager, so vets may join).
    const email = uniqueEmail();
    const registerRes = await register("S6 Journey Newcomer Vet", email, "vet", shelterA.shelterID);
    expect(registerRes.status).toBe(201);
    const vetID = registerRes.body.data.userID;

    // 2. Logging in while Pending works, and says where they are.
    const loginRes = await login(email);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user).toMatchObject({
      role: "Veterinarian",
      accountStatus: "Pending",
      onboardingComplete: false,
      onboardingStep: 2,
    });
    const auth = bearer(loginRes.body.data.token);

    // 3. Only their own onboarding endpoints are open.
    expect((await request(app).get("/api/v1/vets/me").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/v1/vets/me/appointments").set(auth)).status).toBe(401);

    const advance = (step) =>
      request(app).patch("/api/v1/vets/me/onboarding-step").set(auth).send({ step });

    // 4. Step 2 Personal.
    const personalRes = await request(app)
      .put("/api/v1/vets/me")
      .set(auth)
      .send({ vetPhone: "+12125550188", vetDOB: "1990-03-14", vetSex: "M" });
    expect(personalRes.status).toBe(200);
    expect((await advance(2)).body.data.onboardingStep).toBe(3);

    // 5. Step 3 Address.
    const addressRes = await request(app)
      .put("/api/v1/vets/me")
      .set(auth)
      .send({
        addressLine1: "7 Clinic Road",
        city: "New York",
        state: "New York",
        zip: "10001",
        country: "United States",
      });
    expect(addressRes.status).toBe(200);
    expect((await advance(3)).body.data.onboardingStep).toBe(4);

    // Can't finish without an ID.
    const earlyCompleteRes = await request(app)
      .patch("/api/v1/vets/me/onboarding-complete")
      .set(auth);
    expect(earlyCompleteRes.status).toBe(409);
    expect(earlyCompleteRes.body.message).toBe(
      "Onboarding is incomplete — missing: Government ID",
    );

    // 6. Step 4 Identity — a real upload to the private bucket.
    const idRes = await request(app)
      .post("/api/v1/vets/me/government-id")
      .set(auth)
      .field("idType", "Driver's License")
      .field("idNumber", "D7654321")
      .attach("file", Buffer.from("fake-id-scan-bytes"), {
        filename: "id.png",
        contentType: "image/png",
      });
    expect(idRes.status).toBe(201);
    const governmentIDID = idRes.body.data.governmentIDID;
    expect((await advance(4)).body.data.onboardingStep).toBe(5);

    // 7. Step 5 Review → complete. Still Pending until the manager approves.
    const completeRes = await request(app)
      .patch("/api/v1/vets/me/onboarding-complete")
      .set(auth);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data).toMatchObject({
      onboardingComplete: true,
      accountStatus: "Pending",
    });

    // 8. The manager sees them waiting, onboarded, ID not yet verified.
    const managerAuth = bearer(managerA.token);
    const queueRes = await request(app)
      .get("/api/v1/staff/me/vets")
      .query({ section: "pending" })
      .set(managerAuth);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.find((v) => v.userID === vetID)).toMatchObject({
      onboardingComplete: true,
      governmentIdStatus: "Pending",
    });

    const approve = () =>
      request(app)
        .patch(`/api/v1/staff/me/vets/${vetID}/status`)
        .set(managerAuth)
        .send({ accountStatus: "Active" });

    // 9. Approval is refused until the ID is verified.
    const blockedRes = await approve();
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.message).toBe(
      "This veterinarian can't be approved yet — their government ID is Pending, not Verified",
    );

    const verifyRes = await request(app)
      .patch(`/api/v1/government-ids/${governmentIDID}/status`)
      .set(managerAuth)
      .send({ verificationStatus: "Verified" });
    expect(verifyRes.status).toBe(200);

    const approveRes = await approve();
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.accountStatus).toBe("Active");

    // 10. A fresh login is a full one, and the vet-only routes open up.
    const fullLoginRes = await login(email);
    expect(fullLoginRes.status).toBe(200);
    expect(fullLoginRes.body.data.user).toMatchObject({
      accountStatus: "Active",
      onboardingComplete: true,
    });
    const fullAuth = bearer(fullLoginRes.body.data.token);
    expect((await request(app).get("/api/v1/vets/me/appointments").set(fullAuth)).status).toBe(200);
    expect((await request(app).get("/api/v1/vets/me/pets").set(fullAuth)).status).toBe(200);

    const stored = await prisma.veterinarian.findUnique({
      where: { userID: vetID },
      select: { accountStatus: true, onboardingComplete: true, shelterID: true },
    });
    expect(stored).toEqual({
      accountStatus: "Active",
      onboardingComplete: true,
      shelterID: shelterA.shelterID,
    });
  });

  // ——————————————————————————————————————————————————————————————
  test("appointment: staff POST /appointments → vet sees it in /vets/me/appointments → records a vaccination → completes it with notes", async () => {
    const pet = await createPet(managerA, "S6 Appointment Pet");
    const appointment = await bookAppointment(
      managerA,
      pet.petID,
      vetA.userID,
      "Annual check-up and rabies booster",
    );
    const appointmentID = appointment.appointmentID;
    const vetAuth = bearer(vetA.token);

    // 1. In the vet's upcoming queue — and not in another vet's.
    const queueRes = await request(app)
      .get("/api/v1/vets/me/appointments")
      .query({ upcoming: "true" })
      .set(vetAuth);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.find((a) => a.appointmentID === appointmentID)).toMatchObject({
      status: "Scheduled",
    });

    const otherQueueRes = await request(app)
      .get("/api/v1/vets/me/appointments")
      .query({ upcoming: "true" })
      .set(bearer(vetB.token));
    expect(otherQueueRes.body.data.map((a) => a.appointmentID)).not.toContain(appointmentID);

    // 2. Record a dose — allowed while it's still Scheduled.
    const administeredDate = new Date(Date.now() - HOUR).toISOString();
    const doseRes = await recordDose(vetA, appointmentID, {
      vaccineID: vaccine.vaccineID,
      administeredDate,
      dueDate: new Date(Date.now() + 365 * DAY).toISOString(),
    });
    expect(doseRes.status).toBe(201);
    expect(doseRes.body.data).toMatchObject({
      appointmentID,
      vaccineID: vaccine.vaccineID,
      shelterName: shelterA.shelterName,
    });
    const doseID = doseRes.body.data.recordID;

    // Another vet can't record against it — it isn't theirs (404, as if missing).
    const otherDoseRes = await recordDose(vetB, appointmentID, {
      vaccineID: vaccine.vaccineID,
      administeredDate,
    });
    expect(otherDoseRes.status).toBe(404);

    // 3. Too early to complete — the appointment time hasn't come yet.
    const complete = (body) =>
      request(app)
        .patch(`/api/v1/appointments/${appointmentID}/status`)
        .set(vetAuth)
        .send(body);
    const earlyRes = await complete({ appointmentStatus: "Completed", notes: "Too early" });
    expect(earlyRes.status).toBe(409);

    // The appointment time passes. Appointments can only be booked in the
    // future, so move it into the past directly rather than wait.
    await prisma.appointment.update({
      where: { appointmentID },
      data: { appointmentDate: new Date(Date.now() - 30 * 60 * 1000) },
    });

    // 4. Complete with notes → Completed, and the notes become a health
    // record linked to the appointment.
    const notes = "Healthy weight. Rabies booster given.";
    const completeRes = await complete({ appointmentStatus: "Completed", notes });
    expect(completeRes.status).toBe(200);

    // Completing twice is refused.
    expect((await complete({ appointmentStatus: "Completed" })).status).toBe(409);

    const detailRes = await request(app)
      .get(`/api/v1/vets/me/appointments/${appointmentID}`)
      .set(vetAuth);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toMatchObject({
      status: "Completed",
      appointmentStatus: "Completed",
    });
    expect(detailRes.body.data.vaccinesAdministered.map((v) => v.recordID)).toContain(doseID);
    expect(detailRes.body.data.healthRecords.map((r) => r.recordDesc)).toContain(notes);

    // The pet's passport carries both, the note tagged with its appointment.
    const passportRes = await request(app)
      .get(`/api/v1/vets/me/pets/${pet.petID}/health-passport`)
      .set(vetAuth);
    expect(passportRes.status).toBe(200);
    expect(passportRes.body.data.vaccinations.map((v) => v.recordID)).toContain(doseID);
    expect(
      passportRes.body.data.healthRecords.find((r) => r.recordDesc === notes),
    ).toMatchObject({
      appointmentID,
      appointmentCode: appointment.appointmentCode,
    });

    const stored = await prisma.appointment.findUnique({
      where: { appointmentID },
      select: { appointmentStatus: true },
    });
    expect(stored.appointmentStatus).toBe("Completed");
  });

  // ——————————————————————————————————————————————————————————————
  test("passport: dose recorded at shelter A → pet transferred to shelter B → vet at B sees the shelter A dose", async () => {
    const pet = await createPet(managerA, "S6 Transfer Pet");
    const appointment = await bookAppointment(managerA, pet.petID, vetA.userID, "Pre-transfer vaccination");

    // 1. Dose given at shelter A.
    const doseRes = await recordDose(vetA, appointment.appointmentID, {
      vaccineID: vaccine.vaccineID,
      administeredDate: new Date(Date.now() - HOUR).toISOString(),
      dueDate: new Date(Date.now() + 365 * DAY).toISOString(),
    });
    expect(doseRes.status).toBe(201);
    const doseID = doseRes.body.data.recordID;

    const passport = (vet) =>
      request(app)
        .get(`/api/v1/vets/me/pets/${pet.petID}/health-passport`)
        .set(bearer(vet.token));

    // Not B's pet yet — B's vet can't open its passport.
    expect((await passport(vetB)).status).toBe(404);

    // 2. Shelter A sends it to B; B's manager accepts.
    const transferRes = await request(app)
      .post("/api/v1/transfers")
      .set(bearer(managerA.token))
      .send({
        petID: pet.petID,
        toShelterID: shelterB.shelterID,
        transferReason: "Capacity transfer",
      });
    expect(transferRes.status).toBe(201);
    const transferID = transferRes.body.data.recordID;

    const acceptRes = await request(app)
      .patch(`/api/v1/transfers/${transferID}/status`)
      .set(bearer(managerB.token))
      .send({ status: "Completed" });
    expect(acceptRes.status).toBe(200);

    // 3. B's vet now sees the pet's whole history — the shelter A dose and
    // the transfer that brought it over.
    const bPassportRes = await passport(vetB);
    expect(bPassportRes.status).toBe(200);
    expect(bPassportRes.body.data.pet.shelter.shelterName).toBe(shelterB.shelterName);
    expect(bPassportRes.body.data.vaccinations.find((v) => v.recordID === doseID)).toMatchObject({
      vaccineName: vaccine.vaccineName,
      status: "Up to Date",
    });
    expect(
      bPassportRes.body.data.transferHistory.find((t) => t.recordID === transferID),
    ).toMatchObject({
      fromShelterName: shelterA.shelterName,
      toShelterName: shelterB.shelterName,
      transferStatus: "Completed",
    });

    // And the pet has left A — A's vet no longer reaches it.
    expect((await passport(vetA)).status).toBe(404);

    // The dose still records where it was given.
    const storedDose = await prisma.vaccinationRecord.findUnique({
      where: { recordID: doseID },
      select: { administeredAt: true, administeredBy: true },
    });
    expect(storedDose).toEqual({
      administeredAt: shelterA.shelterID,
      administeredBy: vetA.userID,
    });
  });
});
