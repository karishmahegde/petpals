const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — analytics.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  shelter: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  pet: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  adopter: {
    groupBy: jest.fn(),
  },
  adoptionApplication: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  staff: {
    groupBy: jest.fn(),
  },
}));

// authenticate.js calls the real getAccountStatus on every protected
// request; auto-mocked here (same approach as authenticate.test.js) so this
// suite doesn't need a real accountStatus-bearing table for the token's role.
jest.mock("../../../services/auth/auth.service");

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 1) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = () => signToken("Admin");
const staffToken = () => signToken("Staff");

describe("Admin analytics endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /analytics/overview —————————————————————————————
  describe("GET /api/v1/analytics/overview", () => {
    test("adoption rate calculation matches a hand-seeded fixture (7 Accepted of 20 total → 0.35)", async () => {
      prisma.shelter.groupBy.mockResolvedValueOnce([
        { shelterStatus: "Open", _count: 4 },
      ]);
      prisma.pet.groupBy.mockResolvedValueOnce([
        { adoptionStatus: "available", _count: 10 },
      ]);
      prisma.adopter.groupBy.mockResolvedValueOnce([
        { accountStatus: "Active", _count: 25 },
      ]);
      // Hand-seeded: 7 Accepted + 3 Pending + 2 Rejected + 8 Withdrawn = 20
      // applications total, so adoptionRate = 7 / 20 = 0.35.
      prisma.adoptionApplication.groupBy.mockResolvedValueOnce([
        { applicationStatus: "Accepted", _count: 7 },
        { applicationStatus: "Pending", _count: 3 },
        { applicationStatus: "Rejected", _count: 2 },
        { applicationStatus: "Withdrawn", _count: 8 },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications.total).toBe(20);
      expect(res.body.data.applications.byStatus.Accepted).toBe(7);
      expect(res.body.data.applications.adoptionRate).toBe(0.35);
    });

    test("zero applications → adoptionRate is null, not 0", async () => {
      prisma.shelter.groupBy.mockResolvedValueOnce([]);
      prisma.pet.groupBy.mockResolvedValueOnce([]);
      prisma.adopter.groupBy.mockResolvedValueOnce([]);
      prisma.adoptionApplication.groupBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications.total).toBe(0);
      expect(res.body.data.applications.adoptionRate).toBeNull();
    });
  });

  // ————————————————————————————— GET /analytics/shelters —————————————————————————————
  describe("GET /api/v1/analytics/shelters", () => {
    test("utilization % matches petCount / shelterSize for a seeded shelter (18 pets / 40 capacity → 45)", async () => {
      prisma.shelter.findMany.mockResolvedValueOnce([
        {
          shelterID: 3,
          shelterName: "PetPals Brooklyn",
          shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
          shelterPhone: "+12125550105",
          shelterEmail: "brooklyn@petpals.org",
          shelterZIP: 11201,
          shelterSize: 40,
          shelterStatus: "Open",
          managerStaffID: 42,
          manager: { staffName: "Jordan Rivera" },
        },
      ]);
      // 12 available + 6 adopted = 18 pets at shelter 3.
      prisma.pet.groupBy.mockResolvedValueOnce([
        { shelterID: 3, adoptionStatus: "available", _count: 12 },
        { shelterID: 3, adoptionStatus: "adopted", _count: 6 },
      ]);
      prisma.adoptionApplication.groupBy.mockResolvedValueOnce([
        { shelterID: 3, _count: 2 },
      ]);
      prisma.staff.groupBy.mockResolvedValueOnce([{ shelterID: 3, _count: 4 }]);

      const res = await request(app)
        .get("/api/v1/analytics/shelters")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      const brooklyn = res.body.data.find((s) => s.shelterID === 3);
      expect(brooklyn.petCount).toBe(18);
      expect(brooklyn.utilization).toBe(45);
    });

    test("0-capacity shelter → utilization is null, not 0 or Infinity", async () => {
      prisma.shelter.findMany.mockResolvedValueOnce([
        {
          shelterID: 4,
          shelterName: "PetPals Queens",
          shelterAddress: "1 Test Ave",
          shelterPhone: "+12125550105",
          shelterEmail: "queens@petpals.org",
          shelterZIP: 11101,
          shelterSize: 0,
          shelterStatus: "Closed",
          managerStaffID: null,
          manager: null,
        },
      ]);
      prisma.pet.groupBy.mockResolvedValueOnce([]);
      prisma.adoptionApplication.groupBy.mockResolvedValueOnce([]);
      prisma.staff.groupBy.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/shelters")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].utilization).toBeNull();
    });
  });

  // ————————————————————————————— GET /analytics/monthly-stats —————————————————————————————
  describe("GET /api/v1/analytics/monthly-stats", () => {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();

    test("buckets intake and Accepted applications into Jan–Dec of the requested year", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([
        { intakeDate: new Date("2025-03-01T00:00:00Z") },
        { intakeDate: new Date("2025-03-15T12:00:00Z") },
        { intakeDate: new Date("2025-11-20T08:00:00Z") },
      ]);
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([
        { createdAt: new Date("2025-03-10T09:00:00Z") },
        { createdAt: new Date("2025-07-04T18:00:00Z") },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/monthly-stats")
        .query({ year: 2025 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        MONTHS.map((month) => ({
          month,
          year: 2025,
          intake: { Mar: 2, Nov: 1 }[month] ?? 0,
          adoptions: { Mar: 1, Jul: 1 }[month] ?? 0,
        })),
      );
    });

    test("reads only that year's range (UTC), and only Accepted applications", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/analytics/monthly-stats")
        .query({ year: 2025 })
        .set("Authorization", `Bearer ${adminToken()}`);

      const range = {
        gte: new Date(Date.UTC(2025, 0, 1)),
        lt: new Date(Date.UTC(2026, 0, 1)),
      };
      expect(prisma.pet.findMany.mock.calls[0][0].where).toEqual({ intakeDate: range });
      expect(prisma.adoptionApplication.findMany.mock.calls[0][0].where).toEqual({
        applicationStatus: "Accepted",
        createdAt: range,
      });
    });

    // A timestamp just before midnight UTC on the last day of a month belongs
    // to that month — bucketing with local-time getters would move it into
    // the next month on a server running ahead of UTC.
    test("buckets by UTC month, whatever the server's timezone", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([
        { intakeDate: new Date("2025-01-31T23:30:00Z") },
      ]);
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([
        { createdAt: new Date("2025-12-31T23:59:00Z") },
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/monthly-stats")
        .query({ year: 2025 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.body.data[0]).toMatchObject({ month: "Jan", intake: 1 });
      expect(res.body.data[1]).toMatchObject({ month: "Feb", intake: 0 });
      expect(res.body.data[11]).toMatchObject({ month: "Dec", adoptions: 1 });
    });

    test("no year → the current year, all twelve months zeroed when there's no data", async () => {
      prisma.pet.findMany.mockResolvedValueOnce([]);
      prisma.adoptionApplication.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/monthly-stats")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.pet.findMany.mock.calls[0][0].where.intakeDate.gte).toEqual(
        new Date(Date.UTC(currentYear, 0, 1)),
      );
      expect(res.body.data).toEqual(
        MONTHS.map((month) => ({ month, year: currentYear, intake: 0, adoptions: 0 })),
      );
    });

    test.each([
      ["not a number", "abc"],
      ["not an integer", "2025.5"],
      ["before 2000", "1999"],
      ["in the future", String(currentYear + 1)],
    ])("year %s → 400 BAD_REQUEST, nothing queried", async (_label, year) => {
      const res = await request(app)
        .get("/api/v1/analytics/monthly-stats")
        .query({ year })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
      expect(prisma.adoptionApplication.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/analytics/overview"],
      ["get", "/api/v1/analytics/shelters"],
      ["get", "/api/v1/analytics/monthly-stats"],
    ])("%s %s: non-Admin role → 403 FORBIDDEN, nothing queried", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(prisma.shelter.groupBy).not.toHaveBeenCalled();
      expect(prisma.shelter.findMany).not.toHaveBeenCalled();
      expect(prisma.pet.findMany).not.toHaveBeenCalled();
    });
  });
});
