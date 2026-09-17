const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — events.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  shelter: { findUnique: jest.fn() },
  event: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  volunteerEvent: { deleteMany: jest.fn() },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// getEventDetails is the one collaborator worth stubbing — it's already
// covered by its own dedicated suite (public/events.test.js), and
// re-deriving its exact prisma.event.findUnique select shape here would just
// duplicate that coverage.
jest.mock("../../../services/public/events.service", () => ({
  ...jest.requireActual("../../../services/public/events.service"),
  getEventDetails: jest.fn(),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const publicEventsService = require("../../../services/public/events.service");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = () => signToken("Admin", 1);
const adopterToken = () => signToken("Adopter", 7);

const VALID_CREATE_BODY = {
  eventName: "Adoption Day",
  eventDesc: "Come meet our adoptable pets!",
  eventDate: new Date(Date.now() + 86400000).toISOString(),
};

// eventLocation has no input of its own — createEvent auto-assigns it from
// the resolved shelter's name (see events.service.js's
// resolveShelterForCreate), so getEventDetails' (mocked) return value here
// is just a realistic snapshot of that, never a request-body echo.
const buildEventDetail = (overrides = {}) => ({
  eventID: 10,
  eventName: "Adoption Day",
  eventDate: new Date(Date.now() + 86400000),
  eventDesc: "Come meet our adoptable pets!",
  eventLocation: "Athens Shelter",
  shelter: { shelterID: 9, shelterName: "Athens Shelter", shelterAddress: "1 Test Way" },
  ...overrides,
});

describe("Event management (Staff/Admin)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————— POST /api/v1/events —————————————————————
  describe("POST /api/v1/events", () => {
    test("Staff: creates at their own shelter, staffID set to the acting staff member, eventLocation auto-assigned from shelter name", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        shelter: { shelterName: "Athens Shelter" },
      });
      prisma.event.create.mockResolvedValueOnce({ eventID: 10 });
      publicEventsService.getEventDetails.mockResolvedValueOnce(buildEventDetail());

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(201);
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventName: "Adoption Day",
            eventDesc: "Come meet our adoptable pets!",
            eventLocation: "Athens Shelter",
            shelterID: 9,
            staffID: 42,
          }),
        }),
      );
    });

    test("Staff with no shelter assigned -> 409 CONFLICT, nothing written", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    test("Admin: shelterID required and validated, staffID stays null, eventLocation from that shelter's name", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({
        shelterID: 3,
        shelterName: "Brooklyn Shelter",
      });
      prisma.event.create.mockResolvedValueOnce({ eventID: 11 });
      publicEventsService.getEventDetails.mockResolvedValueOnce(buildEventDetail({ eventID: 11 }));

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_CREATE_BODY, shelterID: 3 });

      expect(res.status).toBe(201);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shelterID: 3,
            eventLocation: "Brooklyn Shelter",
            staffID: null,
          }),
        }),
      );
    });

    test("Admin: missing shelterID -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    test("Admin: shelterID doesn't reference an existing shelter -> 404 NOT_FOUND", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_CREATE_BODY, shelterID: 999 });

      expect(res.status).toBe(404);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    test("missing required field -> 400 BAD_REQUEST", async () => {
      const { eventDesc, ...withoutDesc } = VALID_CREATE_BODY;

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send(withoutDesc);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("eventLocation in the body is ignored — the resolved shelter's name is used instead", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        shelter: { shelterName: "Athens Shelter" },
      });
      prisma.event.create.mockResolvedValueOnce({ eventID: 10 });
      publicEventsService.getEventDetails.mockResolvedValueOnce(buildEventDetail());

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ ...VALID_CREATE_BODY, eventLocation: "Main Hall" });

      expect(res.status).toBe(201);
      expect(prisma.event.create.mock.calls[0][0].data.eventLocation).toBe(
        "Athens Shelter",
      );
    });

    test("eventDate in the past -> 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ ...VALID_CREATE_BODY, eventDate: new Date(Date.now() - 86400000).toISOString() });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    test("eventName too long -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ ...VALID_CREATE_BODY, eventName: "x".repeat(46) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    test("Adopter -> 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(403);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    test("unauthenticated -> 401 UNAUTHORIZED", async () => {
      const res = await request(app).post("/api/v1/events").send(VALID_CREATE_BODY);

      expect(res.status).toBe(401);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————— PUT /api/v1/events/:id —————————————————————
  describe("PUT /api/v1/events/:id", () => {
    test("Staff: partial update at their own shelter", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.update.mockResolvedValueOnce({});
      publicEventsService.getEventDetails.mockResolvedValueOnce(
        buildEventDetail({ eventName: "Updated Name" }),
      );

      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ eventName: "Updated Name" });

      expect(res.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { eventID: 10 },
        data: { eventName: "Updated Name" },
      });
    });

    test("Staff acting on another shelter's event -> 403 FORBIDDEN, nothing written", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 3 }); // different shelter

      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ eventName: "Updated Name" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    test("Admin: no shelter restriction", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.update.mockResolvedValueOnce({});
      publicEventsService.getEventDetails.mockResolvedValueOnce(buildEventDetail());

      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ eventName: "Updated Name" });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("event not found -> 404 NOT_FOUND", async () => {
      prisma.event.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put("/api/v1/events/999")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ eventName: "Updated Name" });

      expect(res.status).toBe(404);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    test("no updatable fields provided -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    test("invalid eventDate -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ eventDate: "not-a-date" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    test("eventLocation in the body is ignored — it's never reassigned on PUT", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.update.mockResolvedValueOnce({});
      publicEventsService.getEventDetails.mockResolvedValueOnce(buildEventDetail());

      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ eventName: "Updated Name", eventLocation: "Main Hall" });

      expect(res.status).toBe(200);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { eventID: 10 },
        data: { eventName: "Updated Name" },
      });
    });

    test("Adopter -> 403 FORBIDDEN", async () => {
      const res = await request(app)
        .put("/api/v1/events/10")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send({ eventName: "Updated Name" });

      expect(res.status).toBe(403);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————— DELETE /api/v1/events/:id —————————————————————
  describe("DELETE /api/v1/events/:id", () => {
    test("Staff: deletes at their own shelter, volunteer signups removed alongside it", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteerEvent.deleteMany.mockResolvedValueOnce({ count: 2 });
      prisma.event.delete.mockResolvedValueOnce({});

      const res = await request(app)
        .delete("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.volunteerEvent.deleteMany).toHaveBeenCalledWith({
        where: { eventID: 10 },
      });
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { eventID: 10 } });
    });

    test("Staff acting on another shelter's event -> 403 FORBIDDEN, nothing deleted", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 3 }); // different shelter

      const res = await request(app)
        .delete("/api/v1/events/10")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    test("Admin: no shelter restriction", async () => {
      prisma.event.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteerEvent.deleteMany.mockResolvedValueOnce({ count: 0 });
      prisma.event.delete.mockResolvedValueOnce({});

      const res = await request(app)
        .delete("/api/v1/events/10")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { eventID: 10 } });
    });

    test("event not found -> 404 NOT_FOUND, nothing deleted", async () => {
      prisma.event.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/v1/events/999")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    test("non-integer id -> 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .delete("/api/v1/events/abc")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter -> 403 FORBIDDEN", async () => {
      const res = await request(app)
        .delete("/api/v1/events/10")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });

    test("unauthenticated -> 401 UNAUTHORIZED", async () => {
      const res = await request(app).delete("/api/v1/events/10");

      expect(res.status).toBe(401);
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });
  });
});
