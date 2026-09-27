const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  shelter: { findFirst: jest.fn() },
  veterinarian: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
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
const app = require("../../../app");

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const managerToken = () => signToken("Staff", 42);

const vetRow = (overrides = {}) => ({
  userID: 60,
  avatarSeed: "seed-60",
  vetName: "Adrian Nicholes",
  vetPhone: "+17123954302",
  addressLine1: "12 Oak St",
  addressLine2: null,
  city: "Athens",
  state: "GA",
  zip: "30601",
  country: "United States",
  vetDOB: new Date("1985-04-02"),
  vetSex: "M",
  createdAt: new Date("2026-09-01"),
  accountStatus: "Active",
  user: { userEmail: "adrian@petpals.com" },
  ...overrides,
});

describe("Shelter manager veterinarian management", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/staff/me/vets", () => {
    test("manager: section=all lists approved vets at their shelter, with email flattened", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findMany.mockResolvedValueOnce([vetRow()]);
      prisma.veterinarian.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "all", name: " adr " })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.findMany.mock.calls[0][0].where).toEqual({
        shelterID: 9,
        accountStatus: { in: ["Active", "Deactivated"] },
        vetName: { contains: "adr", mode: "insensitive" },
      });
      expect(res.body.data[0]).toMatchObject({
        userID: 60,
        vetName: "Adrian Nicholes",
        vetEmail: "adrian@petpals.com",
      });
      expect(res.body.data[0].user).toBeUndefined();
    });

    test("section=all + accountStatus narrows to that status", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findMany.mockResolvedValueOnce([]);
      prisma.veterinarian.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "all", accountStatus: "Deactivated" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(prisma.veterinarian.findMany.mock.calls[0][0].where).toEqual({
        shelterID: 9,
        accountStatus: "Deactivated",
      });
    });

    test("section=pending lists vets awaiting approval", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findMany.mockResolvedValueOnce([]);
      prisma.veterinarian.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(prisma.veterinarian.findMany.mock.calls[0][0].where).toEqual({
        shelterID: 9,
        accountStatus: "Pending",
      });
    });

    test("staff who isn't a manager → 403", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "all" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.veterinarian.findMany).not.toHaveBeenCalled();
    });

    test("missing section or bad accountStatus → 400", async () => {
      const noSection = await request(app)
        .get("/api/v1/staff/me/vets")
        .set("Authorization", `Bearer ${managerToken()}`);
      const badStatus = await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "all", accountStatus: "Pending" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(noSection.status).toBe(400);
      expect(badStatus.status).toBe(400);
      expect(prisma.shelter.findFirst).not.toHaveBeenCalled();
    });

    test("Admin role → 403 (Staff-only route)", async () => {
      const res = await request(app)
        .get("/api/v1/staff/me/vets")
        .query({ section: "all" })
        .set("Authorization", `Bearer ${signToken("Admin", 1)}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/staff/me/vets/:id/status", () => {
    test("approve: Pending → Active", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        accountStatus: "Pending",
      });
      prisma.veterinarian.update.mockResolvedValueOnce(vetRow());

      const res = await request(app)
        .patch("/api/v1/staff/me/vets/60/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 60 },
          data: { accountStatus: "Active" },
        }),
      );
    });

    test("Deactivated → Active isn't allowed → 409, nothing written", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        accountStatus: "Deactivated",
      });

      const res = await request(app)
        .patch("/api/v1/staff/me/vets/60/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(409);
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
    });

    test("vet at another shelter → 403, nothing written", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        shelterID: 3,
        accountStatus: "Active",
      });

      const res = await request(app)
        .patch("/api/v1/staff/me/vets/60/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(403);
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
    });

    test("vet not found → 404", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.veterinarian.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/staff/me/vets/999/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(404);
    });

    test("invalid accountStatus → 400, nothing queried", async () => {
      const res = await request(app)
        .patch("/api/v1/staff/me/vets/60/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Pending" });

      expect(res.status).toBe(400);
      expect(prisma.shelter.findFirst).not.toHaveBeenCalled();
    });
  });
});
