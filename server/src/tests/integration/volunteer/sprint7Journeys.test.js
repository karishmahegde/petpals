// Full request-response cycle tests for the Sprint 7 volunteer and donor
// journeys, against the live test database: a volunteer onboarding before
// approval, a task from staff assignment to the volunteer completing it, an
// event assignment from staff to the volunteer's read-only list (and off it
// again when they close their account), and a donation from the Stripe
// webhook's finalizeDonation into the donor's history and totals, surviving
// the donor deleting their account. The unit suites (unit/volunteer/*,
// unit/donor/*, unit/staff/volunteers.management, unit/auth/login) cover
// each rule in isolation; these prove they fit together.
// Same conventions as sprint6Journeys.test.js: real sign-ups and HTTP calls;
// the supporting cast (the shelter's manager, volunteers that aren't the
// subject of the onboarding journey) force-activated via Prisma since their
// approval is covered elsewhere; and everything removed in afterAll — users
// found by the generated emails, so a test that times out after the server
// created an account still gets cleaned up.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");
const { finalizeDonation } = require("../../../services/donor/donations.service");

const createdEmails = [];
const uniqueEmail = () => {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;
  createdEmails.push(email);
  return email;
};

const PASSWORD = "Secret123!";
const DAY = 24 * 60 * 60 * 1000;

// The onboarding journey alone chains ~20 real round trips (sign-up, logins,
// a Storage upload, ID review) against the remote database — past the 30s
// config default (jest.config.js). A timed-out test keeps running while
// afterAll deletes its data, so give it room rather than let the two race.
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
// Manager — activate them and link them as the shelter's manager.
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

// A volunteer who isn't the subject of the onboarding journey — real
// sign-up, then force-approved.
const makeActiveVolunteer = async (shelter, name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "volunteer", shelter.shelterID);
  expect(res.status).toBe(201);
  const userID = res.body.data.userID;
  await prisma.volunteer.update({
    where: { userID },
    data: { accountStatus: "Active", onboardingComplete: true, onboardingStep: 5 },
  });
  const loginRes = await login(email);
  expect(loginRes.status).toBe(200);
  return { userID, token: loginRes.body.data.token };
};

describe("Sprint 7 volunteer + donor journeys", () => {
  let shelter;
  let manager;

  beforeAll(async () => {
    shelter = await makeShelter("S7 Journey Shelter", 10003);
    manager = await makeManager(shelter, "S7 Manager");
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({
      where: { userEmail: { in: createdEmails } },
      select: { userID: true },
    });
    const userIDs = users.map((u) => u.userID);
    const shelterIDs = shelter ? [shelter.shelterID] : [];

    // Children before parents: assignment rows FK tasks/events and
    // volunteers (RESTRICT); tasks, events and donations FK the shelter (and
    // staff).
    await prisma.volunteerTask.deleteMany({ where: { task: { shelterID: { in: shelterIDs } } } });
    await prisma.task.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.volunteerEvent.deleteMany({ where: { event: { shelterID: { in: shelterIDs } } } });
    await prisma.event.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.donation.deleteMany({ where: { shelterID: { in: shelterIDs } } });

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

    // Shelter.managerStaffID → Staff and Staff.shelterID → Shelter point at
    // each other: unlink first, then the role rows and users, then the
    // shelter.
    await prisma.shelter.updateMany({
      where: { shelterID: { in: shelterIDs } },
      data: { managerStaffID: null },
    });
    await prisma.volunteer.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.donor.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("volunteer onboarding: register → Pending login → onboarding steps → government ID → staff verify ID → staff approve → full login", async () => {
    // 1. Sign up at the shelter.
    const email = uniqueEmail();
    const volunteerName = `S7 Journey Newcomer ${Date.now()}`;
    const registerRes = await register(volunteerName, email, "volunteer", shelter.shelterID);
    expect(registerRes.status).toBe(201);
    const volunteerID = registerRes.body.data.userID;

    // 2. Logging in while Pending works, and says where they are.
    const loginRes = await login(email);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user).toMatchObject({
      role: "Volunteer",
      accountStatus: "Pending",
      onboardingComplete: false,
      onboardingStep: 2,
    });
    const auth = bearer(loginRes.body.data.token);

    // 3. Only their own onboarding endpoints are open.
    expect((await request(app).get("/api/v1/volunteers/me").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/v1/volunteers/me/tasks").set(auth)).status).toBe(401);

    const advance = (step) =>
      request(app).patch("/api/v1/volunteers/me/onboarding-step").set(auth).send({ step });

    // 4. Step 2 Personal.
    const personalRes = await request(app)
      .put("/api/v1/volunteers/me")
      .set(auth)
      .send({ volunteerPhone: "+12125550177", volunteerDOB: "1998-07-21", volunteerSex: "F" });
    expect(personalRes.status).toBe(200);
    expect((await advance(2)).body.data.onboardingStep).toBe(3);

    // 5. Step 3 Address.
    const addressRes = await request(app)
      .put("/api/v1/volunteers/me")
      .set(auth)
      .send({
        addressLine1: "9 Helper Street",
        city: "New York",
        state: "New York",
        zip: "10003",
        country: "United States",
      });
    expect(addressRes.status).toBe(200);
    expect((await advance(3)).body.data.onboardingStep).toBe(4);

    // Can't finish without an ID.
    const earlyCompleteRes = await request(app)
      .patch("/api/v1/volunteers/me/onboarding-complete")
      .set(auth);
    expect(earlyCompleteRes.status).toBe(409);
    expect(earlyCompleteRes.body.message).toContain("Government ID");

    // 6. Step 4 Identity — a real upload to the private bucket.
    const idRes = await request(app)
      .post("/api/v1/volunteers/me/government-id")
      .set(auth)
      .field("idType", "Passport")
      .field("idNumber", "P1234567")
      .attach("file", Buffer.from("fake-id-scan-bytes"), {
        filename: "id.png",
        contentType: "image/png",
      });
    expect(idRes.status).toBe(201);
    const governmentIDID = idRes.body.data.governmentIDID;
    expect((await advance(4)).body.data.onboardingStep).toBe(5);

    // 7. Step 5 Review → complete. Still Pending until staff approve.
    const completeRes = await request(app)
      .patch("/api/v1/volunteers/me/onboarding-complete")
      .set(auth);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data).toMatchObject({
      onboardingComplete: true,
      accountStatus: "Pending",
    });

    // 8. Staff see them waiting, onboarded, ID not yet verified.
    const staffAuth = bearer(manager.token);
    const rosterRes = await request(app)
      .get("/api/v1/volunteers")
      .query({ name: volunteerName })
      .set(staffAuth);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data.find((v) => v.userID === volunteerID)).toMatchObject({
      accountStatus: "Pending",
      onboardingComplete: true,
      governmentIdStatus: "Pending",
    });

    const approve = () =>
      request(app)
        .patch(`/api/v1/volunteers/${volunteerID}/status`)
        .set(staffAuth)
        .send({ accountStatus: "Active" });

    // 9. Approval is refused until the ID is verified.
    expect((await approve()).status).toBe(409);

    const verifyRes = await request(app)
      .patch(`/api/v1/government-ids/${governmentIDID}/status`)
      .set(staffAuth)
      .send({ verificationStatus: "Verified" });
    expect(verifyRes.status).toBe(200);

    const approveRes = await approve();
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.accountStatus).toBe("Active");

    // 10. A fresh login is a full one, and the volunteer-only routes open up.
    const fullLoginRes = await login(email);
    expect(fullLoginRes.status).toBe(200);
    expect(fullLoginRes.body.data.user).toMatchObject({
      accountStatus: "Active",
      onboardingComplete: true,
    });
    const fullAuth = bearer(fullLoginRes.body.data.token);
    expect((await request(app).get("/api/v1/volunteers/me/tasks").set(fullAuth)).status).toBe(200);
    expect((await request(app).get("/api/v1/volunteers/me/events").set(fullAuth)).status).toBe(200);
  });

  // ——————————————————————————————————————————————————————————————
  test("task: staff POST /tasks assigning the volunteer → volunteer sees it → marks it Completed → staff see Completed", async () => {
    const volunteer = await makeActiveVolunteer(shelter, "S7 Task Volunteer");
    const staffAuth = bearer(manager.token);
    const volunteerAuth = bearer(volunteer.token);

    // 1. Staff create a task for them.
    const createRes = await request(app)
      .post("/api/v1/tasks")
      .set(staffAuth)
      .send({
        taskName: "Animal_Care",
        taskDesc: "Feed the puppies in enclosures 1-6",
        taskDue: new Date(Date.now() + 2 * DAY).toISOString(),
        volunteerIDs: [volunteer.userID],
      });
    expect(createRes.status).toBe(201);
    const taskID = createRes.body.data.taskID;

    // 2. The volunteer sees it among their open tasks.
    const listRes = await request(app)
      .get("/api/v1/volunteers/me/tasks")
      .query({ taskStatus: "In_progress" })
      .set(volunteerAuth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.find((t) => t.taskID === taskID)).toMatchObject({
      taskName: "Animal_Care",
      taskStatus: "In_progress",
      status: "In_progress",
    });

    // 3. They mark it done; a second attempt is a conflict.
    const completeRes = await request(app)
      .patch(`/api/v1/volunteers/me/tasks/${taskID}/status`)
      .set(volunteerAuth)
      .send({ taskStatus: "Completed" });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.taskStatus).toBe("Completed");

    const againRes = await request(app)
      .patch(`/api/v1/volunteers/me/tasks/${taskID}/status`)
      .set(volunteerAuth)
      .send({ taskStatus: "Completed" });
    expect(againRes.status).toBe(409);

    // 4. Staff see it Completed.
    const staffViewRes = await request(app).get(`/api/v1/tasks/${taskID}`).set(staffAuth);
    expect(staffViewRes.status).toBe(200);
    expect(staffViewRes.body.data).toMatchObject({ taskStatus: "Completed", status: "Completed" });
  });

  // ——————————————————————————————————————————————————————————————
  test("event: staff assign the volunteer → volunteer sees it assigned → staff see them on it → closing the volunteer's account takes them off it", async () => {
    const volunteer = await makeActiveVolunteer(shelter, "S7 Event Volunteer");
    const staffAuth = bearer(manager.token);
    const volunteerAuth = bearer(volunteer.token);

    // 1. Staff create an upcoming event with the volunteer on it.
    const createRes = await request(app)
      .post("/api/v1/events")
      .set(staffAuth)
      .send({
        eventName: `S7 Journey Adoption Day ${Date.now()}`,
        eventDesc: "Created by the Sprint 7 journey suite",
        eventDate: new Date(Date.now() + 5 * DAY).toISOString(),
        eventCategory: "Adoption_Event",
        volunteerIDs: [volunteer.userID],
      });
    expect(createRes.status).toBe(201);
    const eventID = createRes.body.data.eventID;

    // 2. The volunteer sees it as theirs — in the full list and in My Events.
    const allRes = await request(app)
      .get("/api/v1/volunteers/me/events")
      .query({ upcoming: "true" })
      .set(volunteerAuth);
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.find((e) => e.eventID === eventID)).toMatchObject({ assigned: true });

    const mineRes = await request(app)
      .get("/api/v1/volunteers/me/events")
      .query({ upcoming: "true", assigned: "true" })
      .set(volunteerAuth);
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data.map((e) => e.eventID)).toContain(eventID);

    // There's no self sign-up to undo it.
    const signupRes = await request(app)
      .delete(`/api/v1/volunteers/me/events/${eventID}/signup`)
      .set(volunteerAuth);
    expect(signupRes.status).toBe(404);

    // 3. Staff see them on the event.
    const rosterRes = await request(app)
      .get(`/api/v1/events/${eventID}/volunteers`)
      .set(staffAuth);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data.map((v) => v.volunteerID)).toContain(volunteer.userID);

    // 4. Deactivating takes them off events that haven't happened yet.
    const closeRes = await request(app)
      .delete("/api/v1/volunteers/me")
      .set(volunteerAuth)
      .send({ mode: "deactivate" });
    expect(closeRes.status).toBe(200);

    const afterRes = await request(app)
      .get(`/api/v1/events/${eventID}/volunteers`)
      .set(staffAuth);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.data.map((v) => v.volunteerID)).not.toContain(volunteer.userID);
  });

  // ——————————————————————————————————————————————————————————————
  test("donor: finalizeDonation with a fake checkout session → donation in history + stats → account delete keeps the donation", async () => {
    const email = uniqueEmail();
    const registerRes = await register("S7 Journey Donor", email, "donor");
    expect(registerRes.status).toBe(201);
    const donorID = registerRes.body.data.userID;
    const loginRes = await login(email);
    expect(loginRes.status).toBe(200);
    const auth = bearer(loginRes.body.data.token);

    // 1. Before the webhook lands, the confirmation page's poll finds nothing.
    const sessionId = `cs_test_s7journey_${Date.now()}`;
    const pendingRes = await request(app)
      .get("/api/v1/donors/me/donations")
      .query({ checkoutSessionId: sessionId })
      .set(auth);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data).toBeNull();

    // 2. The webhook's handler records it — what Stripe charged, in cents.
    const session = {
      id: sessionId,
      amount_total: 5000,
      payment_intent: null,
      metadata: {
        kind: "donation",
        donorID: String(donorID),
        shelterID: String(shelter.shelterID),
        donationDesc: "For the kittens",
      },
    };
    await finalizeDonation(session);
    // A replayed event records nothing more.
    await finalizeDonation(session);
    expect(await prisma.donation.count({ where: { stripeCheckoutSessionID: sessionId } })).toBe(1);

    // 3. The poll now finds it, and so do history and the totals.
    const foundRes = await request(app)
      .get("/api/v1/donors/me/donations")
      .query({ checkoutSessionId: sessionId })
      .set(auth);
    expect(foundRes.status).toBe(200);
    expect(foundRes.body.data).toMatchObject({
      donationAmt: 50,
      donationDesc: "For the kittens",
      shelter: { shelterID: shelter.shelterID },
    });
    const donationID = foundRes.body.data.donationID;

    const historyRes = await request(app).get("/api/v1/donors/me/donations").set(auth);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.map((d) => d.donationID)).toEqual([donationID]);
    expect(historyRes.body.data[0]).not.toHaveProperty("stripeCheckoutSessionID");

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const statsRes = await request(app)
      .get("/api/v1/donors/me/donations/stats")
      .query({ yearStart })
      .set(auth);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data).toMatchObject({
      totalAmount: 50,
      donationCount: 1,
      thisYearAmount: 50,
    });
    expect(statsRes.body.data.byShelter).toEqual([
      expect.objectContaining({ shelterID: shelter.shelterID, totalAmount: 50, donationCount: 1 }),
    ]);

    // 4. The donor deletes their account — the shelter keeps the donation,
    // with no donor attached.
    const deleteRes = await request(app)
      .delete("/api/v1/donors/me")
      .set(auth)
      .send({ mode: "delete" });
    expect(deleteRes.status).toBe(200);
    expect(await prisma.donor.findUnique({ where: { userID: donorID } })).toBeNull();

    const staffViewRes = await request(app)
      .get(`/api/v1/donations/${donationID}`)
      .set(bearer(manager.token));
    expect(staffViewRes.status).toBe(200);
    expect(staffViewRes.body.data).toMatchObject({ donationAmt: 50, donor: null });
  });
});
