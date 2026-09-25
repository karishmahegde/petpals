const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  shelter: { findFirst: jest.fn() },
  staff: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const managerToken = () => signToken("Staff", 42);
const adminToken = () => signToken("Admin", 1);

const memberRow = (overrides = {}) => ({
  userID: 50,
  staffName: "Ariana Delwon",
  staffPhone: "+17243954201",
  staffDesignation: "Associate",
  staffDOJ: new Date("2024-01-10"),
  accountStatus: "Active",
  user: { userEmail: "ariana@petpals.com" },
  ...overrides,
});

describe("Shelter manager staff management", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/staff/me/team", () => {
    test("manager: section=all lists approved staff at their shelter", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findMany.mockResolvedValueOnce([memberRow()]);
      prisma.staff.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff/me/team")
        .query({ section: "all", staffDesignation: "Associate", name: " ari " })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.shelter.findFirst).toHaveBeenCalledWith({
        where: { managerStaffID: 42 },
        select: { shelterID: true },
      });
      expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({
        shelterID: 9,
        accountStatus: { in: ["Active", "Deactivated"] },
        staffDesignation: "Associate",
        staffName: { contains: "ari", mode: "insensitive" },
      });
      expect(res.body.data[0]).toMatchObject({
        userID: 50,
        staffEmail: "ariana@petpals.com",
      });
    });

    test("section=pending lists only Pending registrations", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findMany.mockResolvedValueOnce([]);
      prisma.staff.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/staff/me/team")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({
        shelterID: 9,
        accountStatus: "Pending",
      });
    });

    test("staff who aren't a shelter's manager -> 403", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/staff/me/team")
        .query({ section: "all" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.staff.findMany).not.toHaveBeenCalled();
    });

    test("Admin -> 403 (they use the org-wide /staff instead)", async () => {
      const res = await request(app)
        .get("/api/v1/staff/me/team")
        .query({ section: "all" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(403);
    });

    test("missing section -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/staff/me/team")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/staff/me/team/:id (designation)", () => {
    test("manager sets Senior on an active colleague", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        staffDesignation: "Associate",
        accountStatus: "Active",
      });
      prisma.staff.update.mockResolvedValueOnce(memberRow({ staffDesignation: "Senior" }));

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ staffDesignation: "Senior" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 50 },
          data: { staffDesignation: "Senior" },
        }),
      );
    });

    test("Manager can't be assigned here -> 400", async () => {
      const res = await request(app)
        .patch("/api/v1/staff/me/team/50")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ staffDesignation: "Manager" });

      expect(res.status).toBe(400);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("staff at another shelter -> 403", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 3,
        staffDesignation: "Associate",
        accountStatus: "Active",
      });

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ staffDesignation: "Senior" });

      expect(res.status).toBe(403);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("the manager's own account -> 403", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/staff/me/team/42")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ staffDesignation: "Senior" });

      expect(res.status).toBe(403);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/v1/staff/me/team/:id/status", () => {
    test("approve: Pending -> Active", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        staffDesignation: null,
        accountStatus: "Pending",
      });
      prisma.staff.update.mockResolvedValueOnce(memberRow());

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { accountStatus: "Active" } }),
      );
    });

    test("Deactivated -> Active isn't allowed -> 409", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        staffDesignation: "Associate",
        accountStatus: "Deactivated",
      });

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(409);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });
  });
});
