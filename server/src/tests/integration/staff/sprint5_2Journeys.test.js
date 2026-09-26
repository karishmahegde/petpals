// Full request-response cycle tests for the Sprint 5.2 Staff journeys —
// visit confirmation and event publishing. Each test chains real HTTP calls
// across roles (adopter, staff, anonymous public) against the live test
// database, rather than exercising one endpoint/case in isolation the way the
// unit suites (unit/staff/visits.review.test.js, unit/staff/
// events.management.test.js, unit/public/events.test.js) do.
// Same conventions as sprint5_1Journeys.test.js: staff register through the
// real sign-up (which requires picking a shelter) and are then force-
// activated via Prisma — the approval flow itself is covered elsewhere — and
// everything created here is removed in afterAll, respecting FK order.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Chained register/login/HTTP round trips against the remote database.
jest.setTimeout(30000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const login = (email, password) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

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

// Staff sign up at a shelter (required) and start Pending — force Active so
// the journey can drive everything through the staff member's own token.
const registerAndLoginActiveStaff = async (name, shelterID) => {
  const payload = {
    name,
    email: uniqueEmail(),
    password: "Secret123!",
    role: "staff",
    shelterID,
  };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  expect(registerRes.status).toBe(201);
  const userID = registerRes.body.data.userID;
  await prisma.staff.update({ where: { userID }, data: { accountStatus: "Active" } });
  const loginRes = await login(payload.email, payload.password);
  return { userID, token: loginRes.body.data.token };
};

const registerAndLoginAdopter = async (name) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role: "adopter" };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  expect(registerRes.status).toBe(201);
  const loginRes = await login(payload.email, payload.password);
  return { userID: registerRes.body.data.userID, token: loginRes.body.data.token };
};

describe("Sprint 5.2 Staff journeys", () => {
  let shelter;
  let otherShelter;
  let staff;
  let otherStaff;
  let adopter;
  const visitIDs = [];
  const eventIDs = [];

  beforeAll(async () => {
    shelter = await makeShelter("S52 Journey Shelter", 10001);
    otherShelter = await makeShelter("S52 Other Shelter", 10002);
    staff = await registerAndLoginActiveStaff("S52 Journey Staff", shelter.shelterID);
    otherStaff = await registerAndLoginActiveStaff(
      "S52 Other Staff",
      otherShelter.shelterID,
    );
    adopter = await registerAndLoginAdopter("S52 Journey Adopter");
  });

  afterAll(async () => {
    // Children before parents: visits/events FK staff, adopter, shelter.
    await prisma.visit.deleteMany({ where: { visitID: { in: visitIDs } } });
    await prisma.volunteerEvent.deleteMany({ where: { eventID: { in: eventIDs } } });
    await prisma.event.deleteMany({ where: { eventID: { in: eventIDs } } });
    const userIDs = [staff, otherStaff, adopter].filter(Boolean).map((u) => u.userID);
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.adopter.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({
      where: {
        shelterID: { in: [shelter, otherShelter].filter(Boolean).map((s) => s.shelterID) },
      },
    });
    await prisma.$disconnect();
  });

  // Books a visit as the adopter — the real POST /visits, not a Prisma seed.
  const bookVisit = async () => {
    const res = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({
        shelterID: shelter.shelterID,
        visitTime: daysFromNow(3).toISOString(),
        remarks: "Would love to meet the dogs",
      });
    expect(res.status).toBe(201);
    visitIDs.push(res.body.data.visitID);
    return res.body.data;
  };

  const setVisitStatus = (visitID, visitStatus, token) =>
    request(app)
      .patch(`/api/v1/visits/${visitID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ visitStatus });

  // ——————————————————————————————————————————————————————————————
  test("full visit lifecycle: adopter POST /visits -> staff confirms -> staff completes", async () => {
    const visit = await bookVisit();
    expect(visit.visitStatus).toBeNull();

    // Shows up in the staff member's shelter queue, unconfirmed.
    const queueRes = await request(app)
      .get("/api/v1/visits")
      .set("Authorization", `Bearer ${staff.token}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.map((v) => v.visitID)).toContain(visit.visitID);

    const confirmRes = await setVisitStatus(visit.visitID, "Confirmed", staff.token);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.visitStatus).toBe("Confirmed");
    expect(confirmRes.body.data.staffID).toBe(staff.userID);

    const completeRes = await setVisitStatus(visit.visitID, "Completed", staff.token);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.visitStatus).toBe("Completed");

    // A completed visit can't be re-opened.
    const reconfirmRes = await setVisitStatus(visit.visitID, "Confirmed", staff.token);
    expect(reconfirmRes.status).toBe(409);

    // The adopter sees the final state on their own list.
    const mineRes = await request(app)
      .get("/api/v1/adopters/me/visits")
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(mineRes.status).toBe(200);
    const mine = mineRes.body.data.find((v) => v.visitID === visit.visitID);
    expect(mine.visitStatus).toBe("Completed");

    const stored = await prisma.visit.findUnique({ where: { visitID: visit.visitID } });
    expect(stored.visitStatus).toBe("Completed");
    expect(stored.staffID).toBe(staff.userID);
  });

  // ——————————————————————————————————————————————————————————————
  test("cross-shelter isolation: staff at a different shelter can't confirm or complete another shelter's visits", async () => {
    const visit = await bookVisit();

    // Not in the other shelter's queue at all.
    const otherQueueRes = await request(app)
      .get("/api/v1/visits")
      .set("Authorization", `Bearer ${otherStaff.token}`);
    expect(otherQueueRes.status).toBe(200);
    expect(otherQueueRes.body.data.map((v) => v.visitID)).not.toContain(visit.visitID);

    const confirmRes = await setVisitStatus(visit.visitID, "Confirmed", otherStaff.token);
    expect(confirmRes.status).toBe(403);
    expect(confirmRes.body.error.code).toBe("FORBIDDEN");

    // Still blocked once the owning shelter has confirmed it.
    const ownConfirmRes = await setVisitStatus(visit.visitID, "Confirmed", staff.token);
    expect(ownConfirmRes.status).toBe(200);

    const completeRes = await setVisitStatus(visit.visitID, "Completed", otherStaff.token);
    expect(completeRes.status).toBe(403);
    expect(completeRes.body.error.code).toBe("FORBIDDEN");

    // Nothing the other shelter's staff tried actually landed.
    const stored = await prisma.visit.findUnique({ where: { visitID: visit.visitID } });
    expect(stored.visitStatus).toBe("Confirmed");
    expect(stored.staffID).toBe(staff.userID);
  });

  // ——————————————————————————————————————————————————————————————
  test("full event lifecycle: staff POST /events -> public GET /events/:id reflects it -> staff PUT -> staff DELETE", async () => {
    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${staff.token}`)
      .send({
        eventName: "S52 Adoption Day",
        eventDesc: "Meet our adoptable pets!",
        eventDate: daysFromNow(10).toISOString(),
        eventCategory: "Adoption_Event",
      });
    expect(createRes.status).toBe(201);
    const eventID = createRes.body.data.eventID;
    eventIDs.push(eventID);

    // Public, no token: the new event is visible, at the staff member's shelter.
    const publicRes = await request(app).get(`/api/v1/events/${eventID}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data).toMatchObject({
      eventID,
      eventName: "S52 Adoption Day",
      eventCategory: "Adoption_Event",
      shelter: { shelterID: shelter.shelterID },
    });

    // Listed publicly too, filtered to this shelter.
    const listRes = await request(app)
      .get("/api/v1/events")
      .query({ shelterID: shelter.shelterID, upcoming: "true" });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.map((e) => e.eventID)).toContain(eventID);

    // Another shelter's staff can't edit or delete it.
    const otherPutRes = await request(app)
      .put(`/api/v1/events/${eventID}`)
      .set("Authorization", `Bearer ${otherStaff.token}`)
      .send({ eventName: "Hijacked" });
    expect(otherPutRes.status).toBe(403);

    const putRes = await request(app)
      .put(`/api/v1/events/${eventID}`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ eventName: "S52 Adoption Day (Rescheduled)", eventCategory: "Fundraiser" });
    expect(putRes.status).toBe(200);

    const updatedPublicRes = await request(app).get(`/api/v1/events/${eventID}`);
    expect(updatedPublicRes.status).toBe(200);
    expect(updatedPublicRes.body.data.eventName).toBe("S52 Adoption Day (Rescheduled)");
    expect(updatedPublicRes.body.data.eventCategory).toBe("Fundraiser");

    const deleteRes = await request(app)
      .delete(`/api/v1/events/${eventID}`)
      .set("Authorization", `Bearer ${staff.token}`);
    expect(deleteRes.status).toBe(200);

    // Gone from the public view.
    const goneRes = await request(app).get(`/api/v1/events/${eventID}`);
    expect(goneRes.status).toBe(404);
  });
});
