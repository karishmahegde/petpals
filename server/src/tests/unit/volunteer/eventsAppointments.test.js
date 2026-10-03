const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  volunteer: { findUnique: jest.fn() },
  event: { findMany: jest.fn(), count: jest.fn() },
  volunteerEvent: { create: jest.fn(), delete: jest.fn() },
  appointment: { findMany: jest.fn(), count: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 30) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const volunteerToken = () => signToken("Volunteer");

const DAY = 24 * 60 * 60 * 1000;

// Matches the public LIST_SELECT plus the caller's own VolunteerEvent row.
const eventRow = (overrides = {}) => ({
  eventID: 4,
  eventName: "Adoption Day",
  eventDate: new Date(Date.now() + 3 * DAY),
  eventDesc: "Meet our adoptable pets",
  eventCategory: "Adoption_Event",
  shelter: { shelterID: 9, shelterName: "Downtown Shelter" },
  volunteers: [],
  ...overrides,
});

// Matches LIST_SELECT in staff/appointments.service.js.
const appointmentRow = (overrides = {}) => ({
  appointmentID: 11,
  appointmentDate: new Date(Date.now() + DAY),
  appointmentReason: "Annual check-up",
  appointmentStatus: "Scheduled",
  pet: {
    petID: 5,
    petCode: "PE000005",
    petName: "Rex",
    petPhoto: null,
    breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
  },
  vet: { vetName: "Jay Asarathi" },
  ...overrides,
});

describe("Volunteer events + appointments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /volunteers/me/events —————————————————————————————
  describe("GET /api/v1/volunteers/me/events", () => {
    const list = (query = {}) =>
      request(app)
        .get("/api/v1/volunteers/me/events")
        .query(query)
        .set("Authorization", `Bearer ${volunteerToken()}`);

    test("every event at the volunteer's shelter, public item shape + assigned flag", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.findMany.mockResolvedValueOnce([
        eventRow({ volunteers: [{ volunteerID: 30 }] }),
        eventRow({ eventID: 5, eventName: "Fundraiser Gala" }),
      ]);
      prisma.event.count.mockResolvedValueOnce(2);

      const res = await list();

      expect(res.status).toBe(200);
      const args = prisma.event.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ shelterID: 9 });
      expect(args.orderBy).toEqual({ eventDate: "asc" });
      // Only the caller's own assignment row is read — never the other volunteers.
      expect(args.select.volunteers).toEqual({
        where: { volunteerID: 30 },
        select: { volunteerID: true },
      });
      expect(res.body.data[0]).toEqual({
        eventID: 4,
        eventName: "Adoption Day",
        eventDate: expect.any(String),
        eventDesc: "Meet our adoptable pets",
        eventCategory: "Adoption_Event",
        shelter: { shelterID: 9, shelterName: "Downtown Shelter" },
        assigned: true,
      });
      expect(res.body.data[1].assigned).toBe(false);
      expect(res.body.data[1]).not.toHaveProperty("volunteers");
    });

    test("upcoming=true → not started yet, soonest first", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.findMany.mockResolvedValueOnce([]);
      prisma.event.count.mockResolvedValueOnce(0);

      await list({ upcoming: "true" });

      const args = prisma.event.findMany.mock.calls[0][0];
      expect(args.where.eventDate).toEqual({ gt: expect.any(Date) });
      expect(args.orderBy).toEqual({ eventDate: "asc" });
    });

    test("upcoming=false → already started, most recent first", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.findMany.mockResolvedValueOnce([]);
      prisma.event.count.mockResolvedValueOnce(0);

      await list({ upcoming: "false" });

      const args = prisma.event.findMany.mock.calls[0][0];
      expect(args.where.eventDate).toEqual({ lte: expect.any(Date) });
      expect(args.orderBy).toEqual({ eventDate: "desc" });
    });

    test("assigned=true → only events the volunteer is on; page/limit paginate", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.event.findMany.mockResolvedValueOnce([]);
      prisma.event.count.mockResolvedValueOnce(7);

      const res = await list({ assigned: "true", page: 2, limit: 5 });

      const args = prisma.event.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        shelterID: 9,
        volunteers: { some: { volunteerID: 30 } },
      });
      expect(args.skip).toBe(5);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    test("volunteer with no shelter → sentinel shelterID -1 (empty list, not an error)", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.event.findMany.mockResolvedValueOnce([]);
      prisma.event.count.mockResolvedValueOnce(0);

      const res = await list();

      expect(res.status).toBe(200);
      expect(prisma.event.findMany.mock.calls[0][0].where.shelterID).toBe(-1);
    });

    test.each([
      [{ upcoming: "soon" }, "upcoming"],
      [{ assigned: "yes" }, "assigned"],
      [{ page: 0 }, "page"],
      [{ limit: 500 }, "limit"],
    ])("invalid %j → 400, nothing read", async (query, field) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    // Staff decide who works an event — there's no self sign-up route.
    test.each(["post", "delete"])("%s /volunteers/me/events/:id/signup doesn't exist → 404", async (method) => {
      const res = await request(app)
        [method]("/api/v1/volunteers/me/events/4/signup")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(404);
      expect(prisma.volunteerEvent.create).not.toHaveBeenCalled();
      expect(prisma.volunteerEvent.delete).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /volunteers/me/appointments —————————————————————————————
  describe("GET /api/v1/volunteers/me/appointments", () => {
    const list = (query = {}) =>
      request(app)
        .get("/api/v1/volunteers/me/appointments")
        .query(query)
        .set("Authorization", `Bearer ${volunteerToken()}`);

    test("upcoming=true → only the caller's Scheduled future appointments, soonest first, staff list-item shape", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([appointmentRow()]);
      prisma.appointment.count.mockResolvedValueOnce(1);

      const res = await list({ upcoming: "true" });

      expect(res.status).toBe(200);
      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        volunteerID: 30,
        appointmentStatus: "Scheduled",
        appointmentDate: { gt: expect.any(Date) },
      });
      expect(args.orderBy).toEqual({ appointmentDate: "asc" });
      expect(res.body.data[0]).toMatchObject({
        appointmentID: 11,
        appointmentReason: "Annual check-up",
        status: "Scheduled",
        vetName: "Jay Asarathi",
        pet: { petName: "Rex" },
      });
    });

    test("default (past) → past-dated or Cancelled, most recent first; a past Scheduled row reads Completed", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([
        appointmentRow({ appointmentDate: new Date(Date.now() - DAY) }),
      ]);
      prisma.appointment.count.mockResolvedValueOnce(1);

      const res = await list();

      const args = prisma.appointment.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        volunteerID: 30,
        OR: [
          { appointmentDate: { lte: expect.any(Date) } },
          { appointmentStatus: "Cancelled" },
        ],
      });
      expect(args.orderBy).toEqual({ appointmentDate: "desc" });
      expect(res.body.data[0].status).toBe("Completed");
    });

    test("a deleted vet's appointment → vetName null", async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([appointmentRow({ vet: null })]);
      prisma.appointment.count.mockResolvedValueOnce(1);

      const res = await list({ upcoming: "true" });

      expect(res.body.data[0].vetName).toBeNull();
    });

    test.each([
      [{ upcoming: "1" }, "upcoming"],
      [{ page: -2 }, "page"],
      [{ limit: 0 }, "limit"],
    ])("invalid %j → 400, nothing read", async (query, field) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ACCESS —————————————————————————————
  describe("access", () => {
    test.each(["/api/v1/volunteers/me/events", "/api/v1/volunteers/me/appointments"])(
      "%s: Staff → 403, nothing read",
      async (path) => {
        const res = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${signToken("Staff", 42)}`);

        expect(res.status).toBe(403);
        expect(prisma.event.findMany).not.toHaveBeenCalled();
        expect(prisma.appointment.findMany).not.toHaveBeenCalled();
      },
    );

    test.each(["/api/v1/volunteers/me/events", "/api/v1/volunteers/me/appointments"])(
      "%s: a Pending volunteer → 401",
      async (path) => {
        authService.getAccountStatus.mockResolvedValue("Pending");

        const res = await request(app)
          .get(path)
          .set("Authorization", `Bearer ${volunteerToken()}`);

        expect(res.status).toBe(401);
      },
    );
  });
});
