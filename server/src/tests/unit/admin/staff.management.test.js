const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — staff.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  shelter: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
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

// Matches the shape selected by STAFF_LIST_SELECT in staff.service.js.
const buildStaffRow = (overrides = {}) => ({
  userID: 42,
  avatarSeed: "seed-42",
  staffName: "Jordan Rivera",
  staffPhone: "+12125550105",
  shelterID: 5,
  staffDOB: "1990-01-01T00:00:00.000Z",
  staffSex: "F",
  staffDOJ: "2024-01-01T00:00:00.000Z",
  staffDOS: null,
  staffDesignation: "Senior",
  accountStatus: "Active",
  shelter: { shelterName: "PetPals Brooklyn" },
  user: { userEmail: "jordan@petpals.org" },
  ...overrides,
});

// STAFF_DETAIL_SELECT = STAFF_LIST_SELECT plus managedShelters.
const buildStaffDetail = (overrides = {}) => ({
  ...buildStaffRow(overrides),
  managedShelters: [],
  ...overrides,
});

describe("Admin staff management endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /staff —————————————————————————————
  describe("GET /api/v1/staff", () => {
    test("shelterID filter → where clause scoped to that shelter, matching subset returned", async () => {
      prisma.staff.findMany.mockResolvedValueOnce([
        buildStaffRow({ userID: 1, shelterID: 5 }),
      ]);
      prisma.staff.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff")
        .query({ shelterID: 5 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterID: 5 } }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].shelterID).toBe(5);
    });

    test("staffDesignation filter → where clause scoped to that designation, matching subset returned", async () => {
      prisma.staff.findMany.mockResolvedValueOnce([
        buildStaffRow({ userID: 2, staffDesignation: "Manager" }),
      ]);
      prisma.staff.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff")
        .query({ staffDesignation: "Manager" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { staffDesignation: "Manager" } }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].staffDesignation).toBe("Manager");
    });

    test("accountStatus filter (including Pending, unlike the status-update target values) → where clause scoped to that status, matching subset returned", async () => {
      prisma.staff.findMany.mockResolvedValueOnce([
        buildStaffRow({ userID: 3, accountStatus: "Pending" }),
      ]);
      prisma.staff.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff")
        .query({ accountStatus: "Pending" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountStatus: "Pending" } }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].accountStatus).toBe("Pending");
    });
  });

  // ————————————————————————————— GET /staff/:id —————————————————————————————
  describe("GET /api/v1/staff/:id", () => {
    test("non-existent ID → 404 NOT_FOUND", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/staff/999")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND" },
      });
    });
  });

  // ————————————————————————————— PATCH /staff/:id —————————————————————————————
  describe("PATCH /api/v1/staff/:id", () => {
    test("changing shelterID away from a shelter they manage clears that shelter's managerStaffID", async () => {
      // Demoted off Manager in the same body, so the update doesn't also
      // make them manager of the NEW shelter — isolates the "clear the OLD
      // shelter" branch this test is actually about.
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 5,
        staffDesignation: "Manager",
      });
      prisma.staff.update.mockResolvedValueOnce({});
      prisma.shelter.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.staff.findUnique.mockResolvedValueOnce(
        buildStaffDetail({ shelterID: 8, staffDesignation: "Senior" }),
      );

      const res = await request(app)
        .patch("/api/v1/staff/42")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ shelterID: 8, staffDesignation: "Senior" });

      expect(res.status).toBe(200);
      expect(res.body.data.shelterID).toBe(8);
      expect(prisma.shelter.updateMany).toHaveBeenCalledWith({
        where: { shelterID: 5, managerStaffID: 42 },
        data: { managerStaffID: null },
      });
      // No longer a Manager, so the new shelter should NOT have been handed
      // managerStaffID as a side effect.
      expect(prisma.shelter.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /staff/:id/status —————————————————————————————
  describe("PATCH /api/v1/staff/:id/status", () => {
    test("deactivating a shelter's current manager clears managerStaffID and stamps staffDOS", async () => {
      // Current row's staffDOJ (read before the update), then the refreshed detail.
      prisma.staff.findUnique.mockResolvedValueOnce({
        staffDOJ: new Date("2020-01-10"),
      });
      prisma.staff.update.mockResolvedValueOnce({});
      prisma.shelter.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.staff.findUnique.mockResolvedValueOnce(
        buildStaffDetail({ accountStatus: "Deactivated" }),
      );

      const res = await request(app)
        .patch("/api/v1/staff/42/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe("Deactivated");
      expect(prisma.shelter.updateMany).toHaveBeenCalledWith({
        where: { managerStaffID: 42 },
        data: { managerStaffID: null },
      });
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { accountStatus: "Deactivated", staffDOS: expect.any(Date) },
      });
    });

    test("approving a Pending non-Manager sign-up → 403 (their shelter manager approves them), nothing written", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({
        staffDOJ: null,
        accountStatus: "Pending",
        staffDesignation: null,
        shelterID: 9,
        shelter: { managerStaffID: 7 },
      });

      const res = await request(app)
        .patch("/api/v1/staff/42/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(403);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("approving a Pending Manager sign-up → 200, becomes the shelter's manager, joining date stamped", async () => {
      prisma.staff.findUnique
        .mockResolvedValueOnce({
          staffDOJ: null,
          accountStatus: "Pending",
          staffDesignation: "Manager",
          shelterID: 9,
          shelter: { managerStaffID: null },
        })
        .mockResolvedValueOnce(buildStaffDetail({ accountStatus: "Active" }));
      prisma.staff.update.mockResolvedValueOnce({});
      prisma.shelter.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/staff/42/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: {
          accountStatus: "Active",
          staffDOJ: expect.any(Date),
          staffDOS: null,
        },
      });
      expect(prisma.shelter.update).toHaveBeenCalledWith({
        where: { shelterID: 9 },
        data: { managerStaffID: 42 },
      });
    });

    test("approving a Manager sign-up at a shelter that already has one → 409", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({
        staffDOJ: null,
        accountStatus: "Pending",
        staffDesignation: "Manager",
        shelterID: 9,
        shelter: { managerStaffID: 7 },
      });

      const res = await request(app)
        .patch("/api/v1/staff/42/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(409);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("GET /staff?name= → case-insensitive contains match on staffName", async () => {
      prisma.staff.findMany.mockResolvedValueOnce([]);
      prisma.staff.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/staff")
        .query({ name: " sash " })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({
        staffName: { contains: "sash", mode: "insensitive" },
      });
    });

    test("GET /staff?awaitingAdmin=true → only Pending Manager sign-ups", async () => {
      prisma.staff.findMany.mockResolvedValueOnce([]);
      prisma.staff.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/staff")
        .query({ awaitingAdmin: "true", limit: 100 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({
        accountStatus: "Pending",
        staffDesignation: "Manager",
      });
    });

    test("invalid accountStatus enum value → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .patch("/api/v1/staff/42/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Suspended" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/staff", undefined],
      ["get", "/api/v1/staff/42", undefined],
      ["patch", "/api/v1/staff/42", { staffDesignation: "Senior" }],
      ["patch", "/api/v1/staff/42/status", { accountStatus: "Active" }],
    ])(
      "%s %s: non-Admin role → 403 FORBIDDEN, nothing written",
      async (method, path, body) => {
        let req = request(app)
          [method](path)
          .set("Authorization", `Bearer ${staffToken()}`);
        if (body) req = req.send(body);

        const res = await req;

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "FORBIDDEN" },
        });
        expect(prisma.staff.findMany).not.toHaveBeenCalled();
        expect(prisma.staff.findUnique).not.toHaveBeenCalled();
        expect(prisma.staff.update).not.toHaveBeenCalled();
      },
    );
  });
});
