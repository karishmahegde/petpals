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
  },
  adopter: {
    groupBy: jest.fn(),
  },
  adoptionApplication: {
    groupBy: jest.fn(),
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

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/analytics/overview"],
      ["get", "/api/v1/analytics/shelters"],
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
    });
  });
});
