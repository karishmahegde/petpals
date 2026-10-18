// Full request-response cycle tests for the Sprint 9 email + account
// journeys, against the live test database: verifying an email to get past
// the apply gate, forgot/reset password, closing and reopening an account
// from an emailed link (adopter back to Active, volunteer back to Pending),
// changing the login email and password, and the review notices staff
// actions send (volunteer approve/decline, government ID verify/reject, an
// application accepted with a second one declined automatically). The unit
// suites (unit/auth/*, unit/email/*, unit/staff/reviewNotices) cover each
// rule in isolation; these prove they fit together.
// services/email is mocked: every email is captured instead of sent, and the
// links are read back out of the captured text — the same way a person
// would follow them. Same conventions as sprint7Journeys.test.js: real
// sign-ups and HTTP calls; the supporting cast (the shelter's manager,
// application rows, government ID rows) set up via Prisma, since their own
// flows are covered elsewhere; and everything removed in afterAll — users
// found by the generated emails (both addresses, for the email change).
jest.mock("../../../services/email", () => ({
  queueEmail: jest.fn(),
  templates: jest.requireActual("../../../services/email/templates"),
}));

const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const { queueEmail } = require("../../../services/email");

const createdEmails = [];
const uniqueEmail = () => {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;
  createdEmails.push(email);
  return email;
};

const PASSWORD = "Secret123!";
const NEW_PASSWORD = "Fresh456#";

// Each journey chains a dozen or more round trips against the remote
// database — past the 30s config default (jest.config.js).
jest.setTimeout(120000);

const register = (name, email, role, shelterID) =>
  request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: PASSWORD, role, shelterID });

const login = (email, password = PASSWORD) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// The most recent captured email to `to` with this subject.
const lastEmail = (to, subject) => {
  const match = queueEmail.mock.calls
    .map(([message]) => message)
    .filter((m) => m.to === to && m.subject === subject)
    .pop();
  if (!match) throw new Error(`No "${subject}" email to ${to} was captured`);
  return match;
};

// The ?token= from the link to `path` in that email's text — what the
// person would click.
const tokenFrom = (message, path) => {
  const url = message.text.match(new RegExp(`https?://\\S+${path}\\S*`))?.[0];
  if (!url) throw new Error(`No ${path} link in "${message.subject}"`);
  return new URL(url).searchParams.get("token");
};

const subjectsTo = (to) =>
  queueEmail.mock.calls.map(([m]) => m).filter((m) => m.to === to).map((m) => m.subject);

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

const registerAdopter = async (name) => {
  const email = uniqueEmail();
  const res = await register(name, email, "adopter");
  expect(res.status).toBe(201);
  const loginRes = await login(email);
  expect(loginRes.status).toBe(200);
  return { userID: res.body.data.userID, email, token: loginRes.body.data.token };
};

describe("Sprint 9 email + account journeys", () => {
  let shelter;
  let manager;
  let speciesID;
  let breedID;
  const petIDs = [];

  const makePet = async (petName) => {
    const pet = await prisma.pet.create({
      data: {
        breedID,
        petName,
        petDOB: new Date("2020-01-01"),
        petWeight: 10,
        petHeight: 10,
        petBGroup: "N/A",
        petColor: "Brown",
        petPhoto: "placeholder.jpg",
        petSex: "M",
        intakeDate: new Date(),
        shelterID: shelter.shelterID,
        adoptionStatus: "available",
      },
    });
    petIDs.push(pet.petID);
    return pet;
  };

  beforeAll(async () => {
    shelter = await makeShelter("S9 Journey Shelter", 10004);
    manager = await makeManager(shelter, "S9 Manager");
    const species = await prisma.species.create({
      data: { speciesName: `S9JourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;
    const breed = await prisma.breed.create({
      data: { speciesID, breedName: "S9JourneyBreed" },
    });
    breedID = breed.breedID;
  });

  beforeEach(() => {
    queueEmail.mockClear();
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({
      where: { userEmail: { in: createdEmails } },
      select: { userID: true },
    });
    const userIDs = users.map((u) => u.userID);
    const shelterIDs = shelter ? [shelter.shelterID] : [];

    // Children before parents. AccountToken rows cascade from Users.
    await prisma.adoptionApplication.deleteMany({ where: { adopterID: { in: userIDs } } });
    await prisma.governmentID.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.pet.deleteMany({ where: { petID: { in: petIDs } } });
    if (breedID) await prisma.breed.deleteMany({ where: { breedID } });
    if (speciesID) await prisma.species.deleteMany({ where: { speciesID } });

    // Shelter.managerStaffID → Staff and Staff.shelterID → Shelter point at
    // each other: unlink first, then the role rows and users, then the
    // shelter.
    await prisma.shelter.updateMany({
      where: { shelterID: { in: shelterIDs } },
      data: { managerStaffID: null },
    });
    await prisma.adopter.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.volunteer.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("email verification: register → applying blocked → open the emailed link → session says verified → applying allowed", async () => {
    const pet = await makePet(`S9 Gate Pet ${Date.now()}`);
    const adopter = await registerAdopter("S9 Gate Adopter");

    // 1. Signing up emails a verification link; the session starts unverified.
    const verifyEmail = lastEmail(adopter.email, "Verify your PetPals email address");
    const loginRes = await login(adopter.email);
    expect(loginRes.body.data.user.emailVerified).toBe(false);

    const apply = () =>
      request(app)
        .post("/api/v1/adoption-applications")
        .set(bearer(adopter.token))
        .send({ petID: pet.petID, shelterID: shelter.shelterID, applicationType: "Adopt" });

    // 2. The soft gate: applying is refused until the email is verified.
    const blockedRes = await apply();
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.error.details).toEqual({ reason: "email_unverified" });

    // 3. Open the link — no session needed.
    const token = tokenFrom(verifyEmail, "/verify-email");
    const verifyRes = await request(app).patch("/api/v1/auth/email-verification").send({ token });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data).toEqual({ emailVerified: true });

    // The same link only works once.
    const againRes = await request(app).patch("/api/v1/auth/email-verification").send({ token });
    expect(againRes.status).toBe(400);
    expect(againRes.body.error.details).toEqual({ reason: "token_used" });

    // 4. The next session says verified, and the gate opens (straight on to
    // Stripe's test-mode Checkout).
    expect((await login(adopter.email)).body.data.user.emailVerified).toBe(true);
    const allowedRes = await apply();
    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.data.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    // Asking for another link now → already verified.
    const resendRes = await request(app)
      .post("/api/v1/auth/email-verification")
      .set(bearer(adopter.token));
    expect(resendRes.status).toBe(409);
    expect(resendRes.body.error.details).toEqual({ reason: "already_verified" });
  });

  // ——————————————————————————————————————————————————————————————
  test("forgot password: request a link → reset with it → old password refused, new one works, notice sent", async () => {
    const adopter = await registerAdopter("S9 Reset Adopter");

    // 1. An unknown address gets the same answer and no email.
    const unknownRes = await request(app)
      .post("/api/v1/auth/password-reset")
      .send({ email: `nobody${Date.now()}@ex.com` });
    expect(unknownRes.status).toBe(200);

    const askRes = await request(app)
      .post("/api/v1/auth/password-reset")
      .send({ email: adopter.email });
    expect(askRes.status).toBe(200);
    expect(askRes.body.message).toBe(unknownRes.body.message);

    // 2. A weak password is refused, and the link stays usable.
    const token = tokenFrom(lastEmail(adopter.email, "Reset your PetPals password"), "/reset-password");
    const weakRes = await request(app)
      .patch("/api/v1/auth/password-reset")
      .send({ token, password: "short" });
    expect(weakRes.status).toBe(422);

    // 3. Reset — the response names the role (the page picks the login).
    const resetRes = await request(app)
      .patch("/api/v1/auth/password-reset")
      .send({ token, password: NEW_PASSWORD });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data).toEqual({ role: "Adopter" });
    lastEmail(adopter.email, "Your PetPals password was changed");

    // 4. The old password no longer works; the new one does, and opening
    // the link proved the address, so it's verified too.
    expect((await login(adopter.email)).status).toBe(401);
    const newLoginRes = await login(adopter.email, NEW_PASSWORD);
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.data.user.emailVerified).toBe(true);
  });

  // ——————————————————————————————————————————————————————————————
  test("reactivation: an adopter closes their account → login says closed → emailed link → Active again", async () => {
    const adopter = await registerAdopter("S9 Closing Adopter");

    // 1. Close (deactivate mode) — writes Closed, emails how to come back.
    const closeRes = await request(app)
      .delete("/api/v1/adopters/me")
      .set(bearer(adopter.token))
      .send({ mode: "deactivate" });
    expect(closeRes.status).toBe(200);
    lastEmail(adopter.email, "Your PetPals account is closed");

    // 2. Login is refused with the reason the page needs to offer a link.
    const closedLoginRes = await login(adopter.email);
    expect(closedLoginRes.status).toBe(401);
    expect(closedLoginRes.body.error.details).toEqual({ reason: "account_closed" });

    // 3. Ask for the link, open it.
    const askRes = await request(app)
      .post("/api/v1/auth/reactivation")
      .send({ email: adopter.email });
    expect(askRes.status).toBe(200);
    const token = tokenFrom(lastEmail(adopter.email, "Reactivate your PetPals account"), "/reactivate");
    const reactivateRes = await request(app).patch("/api/v1/auth/reactivation").send({ token });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data).toEqual({ role: "Adopter", accountStatus: "Active" });

    // 4. Straight back in.
    const loginRes = await login(adopter.email);
    expect(loginRes.status).toBe(200);
    const meRes = await request(app)
      .get("/api/v1/adopters/me")
      .set(bearer(loginRes.body.data.token));
    expect(meRes.body.data.accountStatus).toBe("Active");
  });

  // ——————————————————————————————————————————————————————————————
  test("reactivation: a volunteer closes their account → reopened Pending → logs in to await approval again", async () => {
    const email = uniqueEmail();
    const registerRes = await register("S9 Closing Volunteer", email, "volunteer", shelter.shelterID);
    expect(registerRes.status).toBe(201);
    const volunteerID = registerRes.body.data.userID;
    // Already approved — their approval is covered elsewhere.
    await prisma.volunteer.update({
      where: { userID: volunteerID },
      data: { accountStatus: "Active", onboardingComplete: true, onboardingStep: 5 },
    });
    const token = (await login(email)).body.data.token;

    const closeRes = await request(app)
      .delete("/api/v1/volunteers/me")
      .set(bearer(token))
      .send({ mode: "deactivate" });
    expect(closeRes.status).toBe(200);
    expect((await login(email)).body.error.details).toEqual({ reason: "account_closed" });

    await request(app).post("/api/v1/auth/reactivation").send({ email });
    const linkToken = tokenFrom(lastEmail(email, "Reactivate your PetPals account"), "/reactivate");
    const reactivateRes = await request(app)
      .patch("/api/v1/auth/reactivation")
      .send({ token: linkToken });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data).toEqual({ role: "Volunteer", accountStatus: "Pending" });

    // A Pending volunteer can log in — to the awaiting-approval page.
    const loginRes = await login(email);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.accountStatus).toBe("Pending");
  });

  // ——————————————————————————————————————————————————————————————
  test("account & security: change email via the link sent to the new address, then change password", async () => {
    const adopter = await registerAdopter("S9 Moving Adopter");
    const newEmail = uniqueEmail();

    // 1. Wrong current password → refused, nothing sent.
    const wrongRes = await request(app)
      .post("/api/v1/auth/email-change")
      .set(bearer(adopter.token))
      .send({ newEmail, currentPassword: "Wrong123!" });
    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.error.details).toEqual({ reason: "wrong_password" });

    // 2. Ask — the link goes to the NEW address, a heads-up to the old one;
    // nothing changes yet.
    const askRes = await request(app)
      .post("/api/v1/auth/email-change")
      .set(bearer(adopter.token))
      .send({ newEmail, currentPassword: PASSWORD });
    expect(askRes.status).toBe(200);
    lastEmail(adopter.email, "A request to change your PetPals email address");
    const token = tokenFrom(
      lastEmail(newEmail, "Confirm your new PetPals email address"),
      "/confirm-email-change",
    );
    expect((await login(adopter.email)).status).toBe(200);

    // 3. Confirm — no session needed.
    const confirmRes = await request(app).patch("/api/v1/auth/email-change").send({ token });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data).toEqual({ userEmail: newEmail });
    lastEmail(adopter.email, "Your PetPals email address was changed");

    // 4. Only the new address logs in now, already verified; the profile
    // shows it.
    expect((await login(adopter.email)).status).toBe(404);
    const newLoginRes = await login(newEmail);
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.data.user.emailVerified).toBe(true);
    const auth = bearer(newLoginRes.body.data.token);
    expect((await request(app).get("/api/v1/adopters/me").set(auth)).body.data.userEmail).toBe(
      newEmail,
    );

    // 5. Change password — this session carries on, the new one logs in.
    const changeRes = await request(app)
      .patch("/api/v1/auth/password")
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(changeRes.status).toBe(200);
    lastEmail(newEmail, "Your PetPals password was changed");
    expect((await request(app).get("/api/v1/adopters/me").set(auth)).status).toBe(200);
    expect((await login(newEmail)).status).toBe(401);
    expect((await login(newEmail, NEW_PASSWORD)).status).toBe(200);
  });

  // ——————————————————————————————————————————————————————————————
  test("review notices: verify one volunteer's ID and approve them, reject another's and decline them — each told by email", async () => {
    const staffAuth = bearer(manager.token);

    // Two onboarded Pending volunteers, each with a submitted ID (rows set up
    // directly — the upload itself is covered in sprint7Journeys).
    const signUp = async (name) => {
      const email = uniqueEmail();
      const res = await register(name, email, "volunteer", shelter.shelterID);
      expect(res.status).toBe(201);
      const userID = res.body.data.userID;
      await prisma.volunteer.update({
        where: { userID },
        data: { onboardingComplete: true, onboardingStep: 5 },
      });
      const id = await prisma.governmentID.create({
        data: { userID, userType: "Volunteer", idType: "Passport", idNumber: `S9${userID}` },
      });
      return { userID, email, governmentIDID: id.governmentIDID };
    };
    const keeper = await signUp("S9 Approved Volunteer");
    const leaver = await signUp("S9 Declined Volunteer");

    const reviewId = (governmentIDID, verificationStatus) =>
      request(app)
        .patch(`/api/v1/government-ids/${governmentIDID}/status`)
        .set(staffAuth)
        .send({ verificationStatus });
    const setStatus = (userID, accountStatus) =>
      request(app).patch(`/api/v1/volunteers/${userID}/status`).set(staffAuth).send({ accountStatus });

    // 1. Verified → the verified email, then approval → the approved email.
    expect((await reviewId(keeper.governmentIDID, "Verified")).status).toBe(200);
    lastEmail(keeper.email, "Your government ID is verified");
    expect((await setStatus(keeper.userID, "Active")).status).toBe(200);
    lastEmail(keeper.email, "Your PetPals account is approved");

    // 2. Rejected → asked to upload again; decline → Declined, told so, and
    // login is refused with its own reason.
    expect((await reviewId(leaver.governmentIDID, "Rejected")).status).toBe(200);
    lastEmail(leaver.email, "Your government ID needs another look");
    const declineRes = await setStatus(leaver.userID, "Declined");
    expect(declineRes.status).toBe(200);
    expect(declineRes.body.data.accountStatus).toBe("Declined");
    lastEmail(leaver.email, "Your PetPals sign-up");
    expect((await login(leaver.email)).body.error.details).toEqual({
      reason: "account_declined",
    });

    // A Declined sign-up can't be approved afterwards.
    expect((await setStatus(leaver.userID, "Active")).status).toBe(409);
  });

  // ——————————————————————————————————————————————————————————————
  test("application decision: accepting one application declines the pet's other Pending one — both applicants emailed", async () => {
    const pet = await makePet(`S9 Popular Pet ${Date.now()}`);
    const winner = await registerAdopter("S9 Winning Adopter");
    const runnerUp = await registerAdopter("S9 Runner-up Adopter");

    // Pending applications set up directly — payment is covered in
    // sprint3Journeys.
    const seed = (adopterID) =>
      prisma.adoptionApplication.create({
        data: {
          adopterID,
          petID: pet.petID,
          shelterID: shelter.shelterID,
          applicationType: "Adopt",
          applicationStatus: "Pending",
          stripeCheckoutSessionID: `cs_test_fake_s9_${adopterID}_${Date.now()}_${Math.random()}`,
        },
      });
    const winning = await seed(winner.userID);
    const losing = await seed(runnerUp.userID);
    queueEmail.mockClear();

    const acceptRes = await request(app)
      .patch(`/api/v1/adoption-applications/${winning.applicationID}/status`)
      .set(bearer(manager.token))
      .send({ status: "Accepted", staffRemark: "See you Saturday" });
    expect(acceptRes.status).toBe(200);

    // The other application was declined in the same transaction.
    const other = await prisma.adoptionApplication.findUnique({
      where: { applicationID: losing.applicationID },
      select: { applicationStatus: true },
    });
    expect(other.applicationStatus).toBe("Rejected");

    // One email each, to the right person.
    const approved = lastEmail(winner.email, `Your application for ${pet.petName} was approved`);
    expect(approved.text).toContain('A note from the shelter: "See you Saturday"');
    lastEmail(runnerUp.email, `An update on your application for ${pet.petName}`);
    expect(subjectsTo(winner.email)).toHaveLength(1);
    expect(subjectsTo(runnerUp.email)).toHaveLength(1);
  });
});
