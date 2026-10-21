// Full request-response cycle tests for the Sprint 10 in-app notifications —
// each journey drives the real action as one user, then reads the other
// user's GET /notifications against the live test database: an adoption
// decision with a runner-up, a visit request and its confirmation, a
// transfer and its completion, and a live stream receiving an event while
// connected. Who-gets-what in every case is in the unit suites
// (unit/notifications/ and the Notifications blocks of the service suites);
// these prove the chain works end to end.
// Same conventions as the other journeys: staff are force-activated via
// Prisma (approval is covered elsewhere), applications arrive through a
// locally signed Stripe webhook (as in adopter/sprint3Journeys.test.js), and
// everything is removed in afterAll — Notification rows cascade with their
// user.
const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");
const stripe = require("../../../config/stripe");

// Each journey chains several sign-ups and dozens of requests across roles,
// each a few round trips to the remote test database — well past the 60s
// the shorter journeys use.
jest.setTimeout(180000);

const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const login = (email, password) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// Every account signed up here, recorded the moment it exists so afterAll
// removes it even if a later step of its journey fails.
const createdUserIDs = [];

const register = async (name, role, extra = {}) => {
  const payload = { name, email: uniqueEmail(), password: "Secret123!", role, ...extra };
  const registerRes = await request(app).post("/api/v1/auth/register").send(payload);
  expect(registerRes.status).toBe(201);
  createdUserIDs.push(registerRes.body.data.userID);
  return { userID: registerRes.body.data.userID, payload };
};

const loginAs = async ({ userID, payload }) => {
  const loginRes = await login(payload.email, payload.password);
  expect(loginRes.status).toBe(200);
  return { userID, token: loginRes.body.data.token };
};

// Staff sign up at a shelter and start Pending — force Active (and, for a
// manager, make them the shelter's manager) so the journey can act as them.
const activeStaff = async (name, shelterID, { manager = false } = {}) => {
  const signup = await register(name, "staff", { shelterID });
  await prisma.staff.update({
    where: { userID: signup.userID },
    data: {
      accountStatus: "Active",
      onboardingComplete: true,
      staffDesignation: manager ? "Manager" : "Associate",
    },
  });
  if (manager) {
    await prisma.shelter.update({ where: { shelterID }, data: { managerStaffID: signup.userID } });
  }
  return loginAs(signup);
};

const adopterAccount = async (name) => loginAs(await register(name, "adopter"));

const notificationsOf = async (user, query = {}) => {
  const res = await request(app)
    .get("/api/v1/notifications")
    .query(query)
    .set("Authorization", `Bearer ${user.token}`);
  expect(res.status).toBe(200);
  return res.body;
};

const typesOf = async (user) => (await notificationsOf(user)).data.map((n) => n.type);

describe("Sprint 10 notification journeys", () => {
  let speciesID;
  let breedID;
  const shelterIDs = [];
  const petIDs = [];

  const makeShelter = async (label, zip) => {
    const shelter = await prisma.shelter.create({
      data: {
        shelterName: `${label} ${Date.now()}`,
        shelterAddress: "1 Test Way",
        shelterPhone: "555-0100",
        shelterEmail: `${label.replace(/\s+/g, "").toLowerCase()}${Date.now()}@ex.com`,
        shelterZIP: zip,
        shelterSize: 10,
      },
    });
    shelterIDs.push(shelter.shelterID);
    return shelter;
  };

  const makePet = async (shelterID, petName) => {
    const pet = await prisma.pet.create({
      data: {
        breedID,
        shelterID,
        petName,
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
    petIDs.push(pet.petID);
    return pet;
  };

  // What Stripe's checkout.session.completed would deliver after the fee is
  // paid — the only way an application row is created.
  const paidApplication = async ({ adopter, pet }) => {
    const session = {
      id: `cs_test_s10_${pet.petID}_${adopter.userID}_${Date.now()}`,
      object: "checkout.session",
      payment_status: "paid",
      payment_intent: `pi_test_s10_${Date.now()}`,
      metadata: {
        petID: String(pet.petID),
        adopterID: String(adopter.userID),
        shelterID: String(pet.shelterID),
        applicationType: "Adopt",
        shelterMessage: "",
      },
    };
    const payload = JSON.stringify({
      id: `evt_test_s10_${Date.now()}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: session },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const res = await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature)
      .send(payload);
    expect(res.status).toBe(200);
    return prisma.adoptionApplication.findFirst({
      where: { stripeCheckoutSessionID: session.id },
      select: { applicationID: true },
    });
  };

  beforeAll(async () => {
    const species = await prisma.species.create({
      data: { speciesName: `S10JourneySpecies-${Date.now()}` },
    });
    speciesID = species.speciesID;
    const breed = await prisma.breed.create({ data: { speciesID, breedName: "S10JourneyBreed" } });
    breedID = breed.breedID;
  });

  afterAll(async () => {
    const userIDs = createdUserIDs;
    // Children before parents. Notifications cascade with their user.
    await prisma.adoptionApplication.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.visit.deleteMany({ where: { adopterID: { in: userIDs } } });
    await prisma.transferHistory.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.pet.deleteMany({ where: { petID: { in: petIDs } } });
    await prisma.shelter.updateMany({
      where: { shelterID: { in: shelterIDs } },
      data: { managerStaffID: null },
    });
    await prisma.staff.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.adopter.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.users.deleteMany({ where: { userID: { in: userIDs } } });
    await prisma.shelter.deleteMany({ where: { shelterID: { in: shelterIDs } } });
    await prisma.breed.deleteMany({ where: { breedID } });
    await prisma.species.deleteMany({ where: { speciesID } });
    await prisma.$disconnect();
  });

  // ——————————————————————————————————————————————————————————————
  test("two applications, one accepted: staff hear of both, the winner is approved, the runner-up declined", async () => {
    const shelter = await makeShelter("S10 Adoption Shelter", 10001);
    const staff = await activeStaff("S10 Adoption Staff", shelter.shelterID, { manager: true });
    const winner = await adopterAccount("S10 Winner");
    const runnerUp = await adopterAccount("S10 Runner Up");
    const pet = await makePet(shelter.shelterID, "S10 Biscuit");

    const winning = await paidApplication({ adopter: winner, pet });
    await paidApplication({ adopter: runnerUp, pet });

    // Each paid application: the adopter's receipt and a heads-up to staff.
    expect(await typesOf(winner)).toEqual(["ApplicationSubmitted"]);
    const staffInbox = await notificationsOf(staff);
    expect(staffInbox.data.map((n) => n.type)).toEqual(["NewApplication", "NewApplication"]);
    expect(staffInbox.data.map((n) => n.body)).toEqual([
      "S10 Runner Up applied for S10 Biscuit.",
      "S10 Winner applied for S10 Biscuit.",
    ]);
    expect(staffInbox.unreadCount).toBe(2);

    const acceptRes = await request(app)
      .patch(`/api/v1/adoption-applications/${winning.applicationID}/status`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ status: "Accepted" });
    expect(acceptRes.status).toBe(200);

    const winnerInbox = await notificationsOf(winner);
    expect(winnerInbox.data[0]).toMatchObject({
      type: "ApplicationApproved",
      body: `${shelter.shelterName} approved your application for S10 Biscuit.`,
      link: "/adopter/applications",
      readAt: null,
    });
    expect(winnerInbox.data[0]).not.toHaveProperty("userID");

    const runnerUpInbox = await notificationsOf(runnerUp);
    expect(runnerUpInbox.data.map((n) => n.type)).toEqual([
      "ApplicationDeclined",
      "ApplicationSubmitted",
    ]);
    expect(runnerUpInbox.unreadCount).toBe(2);

    // The decision itself isn't news to the staff member who made it.
    expect((await notificationsOf(staff)).data).toHaveLength(2);
  });

  // ——————————————————————————————————————————————————————————————
  test("visit: the request reaches the shelter's staff; their confirmation reaches the adopter, who reads it", async () => {
    const shelter = await makeShelter("S10 Visit Shelter", 10002);
    const staff = await activeStaff("S10 Visit Staff", shelter.shelterID, { manager: true });
    const colleague = await activeStaff("S10 Visit Colleague", shelter.shelterID);
    const adopter = await adopterAccount("S10 Visitor");
    const pet = await makePet(shelter.shelterID, "S10 Pepper");

    const visitRes = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({ shelterID: shelter.shelterID, petID: pet.petID, visitTime: daysFromNow(3).toISOString() });
    expect(visitRes.status).toBe(201);

    for (const member of [staff, colleague]) {
      const inbox = await notificationsOf(member);
      expect(inbox.data).toEqual([
        expect.objectContaining({
          type: "NewVisitRequest",
          body: "S10 Visitor asked to visit and meet S10 Pepper.",
          link: "/staff/visits",
        }),
      ]);
    }

    const confirmRes = await request(app)
      .patch(`/api/v1/visits/${visitRes.body.data.visitID}`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ visitStatus: "Confirmed" });
    expect(confirmRes.status).toBe(200);

    const unreadRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${adopter.token}`);
    expect(unreadRes.body.data.unreadCount).toBe(1);

    const [confirmed] = (await notificationsOf(adopter, { unread: "true" })).data;
    expect(confirmed).toMatchObject({
      type: "VisitConfirmed",
      body: `${shelter.shelterName} confirmed your visit to meet S10 Pepper.`,
    });

    const readRes = await request(app)
      .patch(`/api/v1/notifications/${confirmed.notificationID}`)
      .set("Authorization", `Bearer ${adopter.token}`)
      .send({ read: true });
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.unreadCount).toBe(0);
    expect((await notificationsOf(adopter, { unread: "true" })).data).toEqual([]);
    expect((await notificationsOf(adopter)).data).toHaveLength(1);

    // Someone else's notification is a 404 to the staff member, same as a missing one.
    const otherRes = await request(app)
      .patch(`/api/v1/notifications/${confirmed.notificationID}`)
      .set("Authorization", `Bearer ${staff.token}`)
      .send({ read: false });
    expect(otherRes.status).toBe(404);

    const markAllRes = await request(app)
      .patch("/api/v1/notifications")
      .set("Authorization", `Bearer ${colleague.token}`)
      .send({ read: true });
    expect(markAllRes.body.data).toEqual({ updated: 1, unreadCount: 0 });
    // The colleague's mark-all touched only their own inbox.
    expect((await notificationsOf(staff)).unreadCount).toBe(1);
  });

  // ——————————————————————————————————————————————————————————————
  test("transfer: the destination's manager hears it's coming; completing it tells the initiator", async () => {
    const origin = await makeShelter("S10 Origin Shelter", 10003);
    const destination = await makeShelter("S10 Destination Shelter", 10004);
    const initiator = await activeStaff("S10 Initiator", origin.shelterID, { manager: true });
    const destinationManager = await activeStaff("S10 Destination Manager", destination.shelterID, {
      manager: true,
    });
    const pet = await makePet(origin.shelterID, "S10 Rover");

    const transferRes = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${initiator.token}`)
      .send({ petID: pet.petID, toShelterID: destination.shelterID, transferReason: "Overcapacity" });
    expect(transferRes.status).toBe(201);

    expect((await notificationsOf(destinationManager)).data).toEqual([
      expect.objectContaining({
        type: "TransferIncoming",
        body: `${origin.shelterName} wants to transfer S10 Rover to your shelter.`,
        link: "/staff/transfers",
      }),
    ]);
    expect(await typesOf(initiator)).toEqual([]);

    const completeRes = await request(app)
      .patch(`/api/v1/transfers/${transferRes.body.data.recordID}/status`)
      .set("Authorization", `Bearer ${destinationManager.token}`)
      .send({ status: "Completed" });
    expect(completeRes.status).toBe(200);

    expect((await notificationsOf(initiator)).data).toEqual([
      expect.objectContaining({
        type: "TransferCompleted",
        body: `${destination.shelterName} accepted the transfer of S10 Rover.`,
      }),
    ]);
    expect(await typesOf(destinationManager)).toEqual(["TransferIncoming"]);
  });

  // ——————————————————————————————————————————————————————————————
  describe("live stream", () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
      server = app.listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    });

    afterAll(async () => {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    });

    // Reads SSE frames off a fetch body until `predicate` matches one.
    const readUntil = async (reader, predicate, seen = []) => {
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`stream ended; saw ${JSON.stringify(seen)}`);
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = raw.match(/^event: (.+)$/m)?.[1];
          const data = raw.match(/^data: (.+)$/m)?.[1];
          if (!event) continue;
          const frame = { event, data: JSON.parse(data) };
          seen.push(frame);
          if (predicate(frame)) return frame;
        }
      }
    };

    test("a connected adopter receives the confirmation the moment staff confirm", async () => {
      const shelter = await makeShelter("S10 Stream Shelter", 10005);
      const staff = await activeStaff("S10 Stream Staff", shelter.shelterID, { manager: true });
      const adopter = await adopterAccount("S10 Streamer");

      const visitRes = await request(app)
        .post("/api/v1/visits")
        .set("Authorization", `Bearer ${adopter.token}`)
        .send({ shelterID: shelter.shelterID, visitTime: daysFromNow(2).toISOString() });
      expect(visitRes.status).toBe(201);

      const controller = new AbortController();
      try {
        const streamRes = await fetch(`${baseUrl}/notifications/stream`, {
          headers: { Authorization: `Bearer ${adopter.token}` },
          signal: controller.signal,
        });
        expect(streamRes.status).toBe(200);
        expect(streamRes.headers.get("content-type")).toMatch(/^text\/event-stream/);
        const reader = streamRes.body.getReader();

        // Opens with the count — nothing yet.
        const opening = await readUntil(reader, (f) => f.event === "unread-count");
        expect(opening.data).toEqual({ unreadCount: 0 });

        const confirmRes = await request(app)
          .patch(`/api/v1/visits/${visitRes.body.data.visitID}`)
          .set("Authorization", `Bearer ${staff.token}`)
          .send({ visitStatus: "Confirmed" });
        expect(confirmRes.status).toBe(200);

        const pushed = await readUntil(reader, (f) => f.event === "notification");
        expect(pushed.data).toMatchObject({
          type: "VisitConfirmed",
          body: `${shelter.shelterName} confirmed your visit.`,
          readAt: null,
        });
        expect(pushed.data).not.toHaveProperty("userID");

        // Marking it read in "another tab" updates this one's count.
        await request(app)
          .patch(`/api/v1/notifications/${pushed.data.notificationID}`)
          .set("Authorization", `Bearer ${adopter.token}`)
          .send({ read: true });
        const recount = await readUntil(reader, (f) => f.event === "unread-count");
        expect(recount.data).toEqual({ unreadCount: 0 });
      } finally {
        controller.abort();
      }
    });

    test("no token → 401, and the stream never opens", async () => {
      const res = await fetch(`${baseUrl}/notifications/stream`);
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
    });
  });
});
