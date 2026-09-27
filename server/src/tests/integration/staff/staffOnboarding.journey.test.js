// Full request-response journey for staff onboarding before approval,
// against the live test database: a new staff member signs up, logs in
// while still Pending, can only reach their own onboarding endpoints,
// fills in their profile and uploads a government ID, completes onboarding,
// and is approved by their shelter's manager — which only works once the
// manager has verified the ID. The unit suites (auth/login, auth/
// authenticate, staff/staff.selfService, staff/shelterStaff.management)
// cover each rule in isolation; this proves they fit together.
// Same conventions as sprint5_2Journeys.test.js: real sign-up and HTTP
// calls, the manager force-activated via Prisma (manager approval is covered
// elsewhere), and everything removed in afterAll — found by the generated
// emails, so a test that times out after the server created an account
// still gets cleaned up.
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

// One test chains ~20 real round trips (sign-ups, logins, a Storage upload,
// ID review) against the remote database — well past the 30s config default
// (jest.config.js). A timed-out test keeps running while afterAll deletes
// its data, so give it room rather than let the two race.
jest.setTimeout(120000);

const register = (name, email, shelterID) =>
  request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: PASSWORD, role: "staff", shelterID });

const login = (email) =>
  request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });

describe("Staff onboarding journey (onboard before approval)", () => {
  let shelter;
  let manager;

  beforeAll(async () => {
    shelter = await prisma.shelter.create({
      data: {
        shelterName: `Onboarding Journey Shelter ${Date.now()}`,
        shelterAddress: "1 Test Way",
        shelterPhone: "555-0100",
        shelterEmail: `onboardingjourney${Date.now()}@ex.com`,
        shelterZIP: 10001,
        shelterSize: 10,
      },
    });

    // The first sign-up at a manager-less shelter registers as its (Pending)
    // Manager — activate them directly.
    const email = uniqueEmail();
    const registerRes = await register("Journey Manager", email, shelter.shelterID);
    expect(registerRes.status).toBe(201);
    const managerID = registerRes.body.data.userID;
    await prisma.staff.update({
      where: { userID: managerID },
      data: { accountStatus: "Active", staffDesignation: "Manager", onboardingComplete: true },
    });
    await prisma.shelter.update({
      where: { shelterID: shelter.shelterID },
      data: { managerStaffID: managerID },
    });
    const loginRes = await login(email);
    manager = { userID: managerID, token: loginRes.body.data.token };
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({
      where: { userEmail: { in: createdEmails } },
      select: { userID: true },
    });
    const userIDs = users.map((u) => u.userID);
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
    if (shelter) {
      // Shelter.managerStaffID → Staff and Staff.shelterID → Shelter point at
      // each other: unlink first, then staff/users, then the shelter.
      await prisma.shelter.update({
        where: { shelterID: shelter.shelterID },
        data: { managerStaffID: null },
      });
    }
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    if (shelter) {
      await prisma.shelter.delete({ where: { shelterID: shelter.shelterID } });
    }
    await prisma.$disconnect();
  });

  test("sign up → Pending login → onboard → ID verified → manager approves → full access", async () => {
    // 1. Sign up — not the first at this shelter, so an ordinary Pending member.
    const email = uniqueEmail();
    const registerRes = await register("Journey Newcomer", email, shelter.shelterID);
    expect(registerRes.status).toBe(201);
    const newcomerID = registerRes.body.data.userID;

    // 2. Logging in while Pending works, and says where they are.
    const loginRes = await login(email);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user).toMatchObject({
      accountStatus: "Pending",
      onboardingComplete: false,
      onboardingStep: 2,
    });
    const auth = { Authorization: `Bearer ${loginRes.body.data.token}` };

    // 3. Only their own onboarding endpoints are open.
    expect((await request(app).get("/api/v1/staff/me").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/v1/staff/me/pets").set(auth)).status).toBe(401);

    const advance = (step) =>
      request(app).patch("/api/v1/staff/me/onboarding-step").set(auth).send({ step });

    // 4. Step 2 Personal.
    const personalRes = await request(app)
      .put("/api/v1/staff/me")
      .set(auth)
      .send({ staffPhone: "+12125550199", staffDOB: "1994-05-06", staffSex: "F" });
    expect(personalRes.status).toBe(200);
    expect((await advance(2)).body.data.onboardingStep).toBe(3);

    // 5. Step 3 Address.
    const addressRes = await request(app)
      .put("/api/v1/staff/me")
      .set(auth)
      .send({
        addressLine1: "22 Journey Street",
        city: "New York",
        state: "New York",
        zip: "10001",
        country: "United States",
      });
    expect(addressRes.status).toBe(200);
    expect((await advance(3)).body.data.onboardingStep).toBe(4);

    // Can't finish without an ID.
    const earlyCompleteRes = await request(app)
      .patch("/api/v1/staff/me/onboarding-complete")
      .set(auth);
    expect(earlyCompleteRes.status).toBe(409);
    expect(earlyCompleteRes.body.message).toBe(
      "Onboarding is incomplete — missing: Government ID",
    );

    // 6. Step 4 Identity — a real upload to the private bucket.
    const idRes = await request(app)
      .post("/api/v1/staff/me/government-id")
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

    // 7. Step 5 Review → complete.
    const completeRes = await request(app)
      .patch("/api/v1/staff/me/onboarding-complete")
      .set(auth);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data).toMatchObject({
      onboardingComplete: true,
      accountStatus: "Pending",
    });

    // 8. The manager sees them waiting, onboarded, ID not yet verified.
    const managerAuth = { Authorization: `Bearer ${manager.token}` };
    const queueRes = await request(app)
      .get("/api/v1/staff/me/team")
      .query({ section: "pending" })
      .set(managerAuth);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.find((m) => m.userID === newcomerID)).toMatchObject({
      onboardingComplete: true,
      governmentIdStatus: "Pending",
    });

    const approve = () =>
      request(app)
        .patch(`/api/v1/staff/me/team/${newcomerID}/status`)
        .set(managerAuth)
        .send({ accountStatus: "Active", staffDesignation: "Associate" });

    // 9. Approval is refused until the ID is verified.
    const blockedRes = await approve();
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.message).toBe(
      "This staff member can't be approved yet — their government ID is Pending, not Verified",
    );

    const verifyRes = await request(app)
      .patch(`/api/v1/government-ids/${governmentIDID}/status`)
      .set(managerAuth)
      .send({ verificationStatus: "Verified" });
    expect(verifyRes.status).toBe(200);

    const approveRes = await approve();
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.accountStatus).toBe("Active");

    // 10. The same session now reaches staff-only endpoints — status is
    // checked live on every request, no re-login needed.
    expect((await request(app).get("/api/v1/staff/me/pets").set(auth)).status).toBe(200);

    const stored = await prisma.staff.findUnique({
      where: { userID: newcomerID },
      select: { accountStatus: true, staffDesignation: true, onboardingComplete: true, staffDOJ: true },
    });
    expect(stored).toMatchObject({
      accountStatus: "Active",
      staffDesignation: "Associate",
      onboardingComplete: true,
    });
    expect(stored.staffDOJ).not.toBeNull();
  });
});
