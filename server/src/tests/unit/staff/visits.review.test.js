const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — visits.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  visit: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = (userID = 1) => signToken("Admin", userID);
const adopterToken = (userID = 7) => signToken("Adopter", userID);

// Matches visits.service.js's STAFF_LIST_SELECT shape.
const buildListRow = (overrides = {}) => ({
  visitID: 1,
  adopterID: 7,
  petID: 5,
  staffID: null,
  shelterID: 9,
  visitTime: new Date(Date.now() + 86400000),
  remarks: null,
  visitStatus: null,
  pet: { petName: "Rex" },
  adopter: {
    adopterName: "Emilie",
    user: { userEmail: "emilie@example.com" },
  },
  staff: null,
  ...overrides,
});

// Matches VISIT_SELECT + shelter/pet join updateVisitStatus's own update() selects.
const buildUpdatedVisit = (overrides = {}) => ({
  visitID: 1,
  adopterID: 7,
  petID: 5,
  staffID: null,
  shelterID: 9,
  visitTime: new Date(Date.now() + 86400000),
  remarks: null,
  visitStatus: null,
  shelter: { shelterName: "Athens Shelter" },
  pet: { petName: "Rex" },
  ...overrides,
});

describe("Visit queue & staff transitions (Staff/Admin)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————— GET /api/v1/visits —————————————————————
  describe("GET /api/v1/visits (staff queue)", () => {
    test("Staff: scoped to their own shelter even with no filter applied", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.visit.findMany.mockResolvedValueOnce([buildListRow()]);
      prisma.visit.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterID: 9 } }),
      );
      expect(res.body.data).toHaveLength(1);
    });

    test("Staff: no shelter assigned → sentinel shelterID (-1), empty result, not an error", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.visit.findMany.mockResolvedValueOnce([]);
      prisma.visit.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(200);
      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterID: -1 } }),
      );
      expect(res.body.data).toEqual([]);
    });

    test("?upcoming=true is applied alongside the shelter scope", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.visit.findMany.mockResolvedValueOnce([]);
      prisma.visit.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/visits")
        .query({ upcoming: "true" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shelterID: 9,
            visitTime: { gt: expect.any(Date) },
            // Upcoming excludes Cancelled; null (unconfirmed) must stay in.
            AND: [{ OR: [{ visitStatus: null }, { visitStatus: { not: "Cancelled" } }] }],
          },
        }),
      );
    });

    test("Admin: an explicit ?shelterID= scopes the query, staff table never consulted", async () => {
      prisma.visit.findMany.mockResolvedValueOnce([]);
      prisma.visit.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/visits")
        .query({ shelterID: 3 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterID: 3 } }),
      );
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("Admin: no shelterID param → unscoped, network-wide query", async () => {
      prisma.visit.findMany.mockResolvedValueOnce([]);
      prisma.visit.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    test("invalid page value → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/visits")
        .query({ page: "0" })
        .set("Authorization", `Bearer ${staffToken(42)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.visit.findMany).not.toHaveBeenCalled();
    });

    test("Adopter → 403 FORBIDDEN, nothing queried", async () => {
      const res = await request(app)
        .get("/api/v1/visits")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(prisma.visit.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————— PATCH /api/v1/visits/:id —————————————————
  describe("PATCH /api/v1/visits/:id", () => {
    test("Confirm an unconfirmed (null-status) visit: staffID set to the acting staff member", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() + 86400000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.visit.update.mockResolvedValueOnce(
        buildUpdatedVisit({ visitStatus: "Confirmed", staffID: 42 }),
      );

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(200);
      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { visitID: 1 },
          data: { visitStatus: "Confirmed", staffID: 42 },
        }),
      );
    });

    test("Confirm an already-Confirmed visit → 409 CONFLICT, nothing written", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: "Confirmed",
        visitTime: new Date(Date.now() + 86400000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    test("Complete a Confirmed visit: staffID set to the acting staff member", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: "Confirmed",
        visitTime: new Date(Date.now() - 3600000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.visit.update.mockResolvedValueOnce(
        buildUpdatedVisit({ visitStatus: "Completed", staffID: 42 }),
      );

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Completed" });

      expect(res.status).toBe(200);
      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { visitStatus: "Completed", staffID: 42 },
        }),
      );
    });

    test("Complete an already-Cancelled visit → 409 CONFLICT, nothing written", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: "Cancelled",
        visitTime: new Date(Date.now() - 3600000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Completed" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    test("Complete a not-yet-confirmed (null-status) visit → 409 CONFLICT", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() - 3600000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Completed" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    test("Staff acting on another shelter's visit → 403 FORBIDDEN, nothing written", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() + 86400000),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 3 }); // different shelter

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    test("Admin confirming any shelter's visit: no shelter restriction, staffID stays null (no Staff row of their own)", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() + 86400000),
      });
      prisma.visit.update.mockResolvedValueOnce(
        buildUpdatedVisit({ visitStatus: "Confirmed" }),
      );

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(prisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { visitStatus: "Confirmed" }, // no staffID key at all
        }),
      );
    });

    test("visit not found → 404 NOT_FOUND", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/visits/999")
        .set("Authorization", `Bearer ${staffToken(42)}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(404);
    });

    // ————— Adopter branch of the same shared endpoint (Cancel) —————
    test("Adopter cancelling their own upcoming visit → 200", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 7,
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() + 86400000),
      });
      prisma.visit.update.mockResolvedValueOnce(
        buildUpdatedVisit({ visitStatus: "Cancelled" }),
      );

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ visitStatus: "Cancelled" });

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter cancelling someone else's visit → 403 FORBIDDEN", async () => {
      prisma.visit.findUnique.mockResolvedValueOnce({
        visitID: 1,
        adopterID: 999, // not the caller
        shelterID: 9,
        visitStatus: null,
        visitTime: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ visitStatus: "Cancelled" });

      expect(res.status).toBe(403);
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    // Deviation from a literal "Adopter role -> 403" reading: this route is
    // shared with Adopter's own Cancel action (authorizeRoles allows Adopter
    // through), so a Staff-only value isn't rejected by role at all — it
    // just isn't in VALID_ADOPTER_VISIT_STATUS_CHANGES, so it fails the same
    // generic value check any bogus string would (400, not 403).
    test("Adopter attempting a Staff-only status (Confirmed) → 400 BAD_REQUEST, not 403", async () => {
      const res = await request(app)
        .patch("/api/v1/visits/1")
        .set("Authorization", `Bearer ${adopterToken(7)}`)
        .send({ visitStatus: "Confirmed" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.visit.findUnique).not.toHaveBeenCalled();
    });
  });
});
