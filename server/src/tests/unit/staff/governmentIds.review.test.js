const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn(), findMany: jest.fn() },
  shelter: { findUnique: jest.fn() },
  adopter: { findMany: jest.fn(), findUnique: jest.fn() },
  volunteer: { findMany: jest.fn(), findUnique: jest.fn() },
  veterinarian: { findMany: jest.fn(), findUnique: jest.fn() },
  admin: { findMany: jest.fn(), findUnique: jest.fn() },
  adoptionApplication: { findMany: jest.fn(), findFirst: jest.fn() },
  governmentID: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  createSignedUrl: jest.fn().mockResolvedValue("https://signed.test/doc"),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const staffToken = (userID) =>
  jwt.sign({ userID, role: "Staff" }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

const adminToken = () =>
  jwt.sign({ userID: 1, role: "Admin" }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

const MANAGER_ID = 42;
const ASSOCIATE_ID = 43;

// The caller's own Staff row: shelter 9, managed by MANAGER_ID.
const mockCaller = () =>
  prisma.staff.findUnique.mockResolvedValueOnce({
    shelterID: 9,
    shelter: { managerStaffID: MANAGER_ID },
  });

const idRecord = (overrides = {}) => ({
  governmentIDID: 5,
  userID: 70,
  userType: "Staff",
  idType: "Passport",
  idNumber: "X1234567",
  verificationStatus: "Pending",
  documentURL: "ids/70.jpg",
  ...overrides,
});

describe("Government ID review — who may review which person types", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
    prisma.governmentID.findMany.mockResolvedValue([]);
    prisma.governmentID.count.mockResolvedValue(0);
    prisma.adoptionApplication.findMany.mockResolvedValue([]);
    prisma.volunteer.findMany.mockResolvedValue([]);
    prisma.staff.findMany.mockResolvedValue([]);
    prisma.veterinarian.findMany.mockResolvedValue([]);
    prisma.admin.findMany.mockResolvedValue([]);
  });

  describe("GET /api/v1/government-ids", () => {
    test("non-manager staff: only Adopter + Volunteer IDs are queried", async () => {
      mockCaller();

      const res = await request(app)
        .get("/api/v1/government-ids")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${staffToken(ASSOCIATE_ID)}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany).not.toHaveBeenCalled();
      expect(prisma.veterinarian.findMany).not.toHaveBeenCalled();
      const types = prisma.governmentID.findMany.mock.calls[0][0].where.OR.map(
        (branch) => branch.userType,
      );
      expect(types).toEqual(["Adopter", "Volunteer"]);
    });

    test("non-manager reviewing a vet's ID → 403", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(
        idRecord({ userType: "Veterinarian", userID: 80 }),
      );
      mockCaller();

      const res = await request(app)
        .get("/api/v1/government-ids/5")
        .set("Authorization", `Bearer ${staffToken(ASSOCIATE_ID)}`);

      expect(res.status).toBe(403);
    });

    test("non-manager filtering to Staff → empty page, no staff lookup", async () => {
      mockCaller();

      const res = await request(app)
        .get("/api/v1/government-ids")
        .query({ section: "pending", userType: "Staff" })
        .set("Authorization", `Bearer ${staffToken(ASSOCIATE_ID)}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findMany).not.toHaveBeenCalled();
      expect(prisma.governmentID.findMany.mock.calls[0][0].where).toMatchObject({
        userID: { in: [] },
      });
    });

    test("manager: all four types, their own ID excluded from the Staff branch", async () => {
      mockCaller();
      prisma.staff.findMany.mockResolvedValueOnce([
        { userID: MANAGER_ID },
        { userID: 70 },
      ]);
      prisma.veterinarian.findMany.mockResolvedValueOnce([{ userID: 80 }]);

      const res = await request(app)
        .get("/api/v1/government-ids")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${staffToken(MANAGER_ID)}`);

      expect(res.status).toBe(200);
      const branches = prisma.governmentID.findMany.mock.calls[0][0].where.OR;
      expect(branches.map((b) => b.userType)).toEqual([
        "Adopter",
        "Volunteer",
        "Staff",
        "Veterinarian",
      ]);
      expect(branches[2]).toEqual({ userType: "Staff", userID: { in: [70] } });
      expect(branches[3]).toEqual({
        userType: "Veterinarian",
        userID: { in: [80] },
      });
    });

    test("invalid userType → 400", async () => {
      const res = await request(app)
        .get("/api/v1/government-ids")
        .query({ section: "pending", userType: "Owner" })
        .set("Authorization", `Bearer ${staffToken(MANAGER_ID)}`);

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/government-ids/:id/status", () => {
    test("non-manager reviewing a Staff ID → 403, nothing written", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(idRecord());
      mockCaller();

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${staffToken(ASSOCIATE_ID)}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("manager reviewing a vet's ID at their shelter → 200", async () => {
      prisma.governmentID.findUnique
        .mockResolvedValueOnce(idRecord({ userType: "Veterinarian", userID: 80 }))
        .mockResolvedValueOnce(
          idRecord({
            userType: "Veterinarian",
            userID: 80,
            verificationStatus: "Verified",
          }),
        );
      mockCaller(); // update's ownership check
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.governmentID.update.mockResolvedValueOnce({});
      mockCaller(); // the refreshed detail's ownership check
      prisma.veterinarian.findUnique
        .mockResolvedValueOnce({ shelterID: 9 })
        .mockResolvedValueOnce({
          userID: 80,
          vetName: "Adrian Nicholes",
          avatarSeed: "seed",
          user: { userEmail: "adrian@petpals.com" },
        });

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${staffToken(MANAGER_ID)}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(200);
      expect(prisma.governmentID.update).toHaveBeenCalledWith({
        where: { governmentIDID: 5 },
        data: { verificationStatus: "Verified" },
      });
      expect(res.body.data.personName).toBe("Adrian Nicholes");
    });

    test("manager reviewing their own ID → 403", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(
        idRecord({ userID: MANAGER_ID }),
      );

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${staffToken(MANAGER_ID)}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("manager reviewing another shelter's staff ID → 403", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(idRecord());
      mockCaller();
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 3 });

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${staffToken(MANAGER_ID)}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("Admin reviewing a non-manager's staff ID → 403", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(idRecord());
      prisma.staff.findUnique.mockResolvedValueOnce({
        staffDesignation: "Senior",
      });

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("Admin reviewing a manager's ID → allowed", async () => {
      prisma.governmentID.findUnique
        .mockResolvedValueOnce(idRecord({ userID: MANAGER_ID }))
        .mockResolvedValueOnce(
          idRecord({ userID: MANAGER_ID, verificationStatus: "Verified" }),
        );
      prisma.staff.findUnique
        .mockResolvedValueOnce({ staffDesignation: "Manager" }) // update's check
        .mockResolvedValueOnce({ staffDesignation: "Manager" }) // refreshed detail's check
        .mockResolvedValueOnce({
          userID: MANAGER_ID,
          staffName: "Sasha Grey",
          avatarSeed: "seed",
          user: { userEmail: "staff@petpals.com" },
        });
      prisma.governmentID.update.mockResolvedValueOnce({});

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(200);
      expect(prisma.governmentID.update).toHaveBeenCalled();
    });

    test("Admin reviewing a vet's ID → 403 (their manager's job)", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(
        idRecord({ userType: "Veterinarian", userID: 80 }),
      );

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("Admin list: Managers' and Admins' IDs only", async () => {
      await request(app)
        .get("/api/v1/government-ids")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.staff.findMany.mock.calls[0][0].where).toEqual({
        AND: [{}, { staffDesignation: "Manager" }],
      });
      expect(prisma.admin.findMany).toHaveBeenCalled();
      expect(prisma.veterinarian.findMany).not.toHaveBeenCalled();
      expect(prisma.adoptionApplication.findMany).not.toHaveBeenCalled();
      expect(prisma.volunteer.findMany).not.toHaveBeenCalled();
    });

    test("Admin reviewing another Admin's ID → allowed; their own → 403", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(
        idRecord({ userType: "Admin", userID: 1 }),
      );
      const own = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });
      expect(own.status).toBe(403);

      prisma.governmentID.findUnique
        .mockResolvedValueOnce(idRecord({ userType: "Admin", userID: 2 }))
        .mockResolvedValueOnce(
          idRecord({ userType: "Admin", userID: 2, verificationStatus: "Verified" }),
        );
      prisma.governmentID.update.mockResolvedValueOnce({});
      prisma.admin.findUnique.mockResolvedValueOnce({
        userID: 2,
        adminName: "Jordan Lee",
        avatarSeed: "seed",
        user: { userEmail: "jordan@petpals.com" },
      });

      const other = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });
      expect(other.status).toBe(200);
      expect(other.body.data.personName).toBe("Jordan Lee");
    });

    test("Admin reviewing an adopter's ID → 403 (staff's job)", async () => {
      prisma.governmentID.findUnique.mockResolvedValueOnce(
        idRecord({ userType: "Adopter", userID: 12 }),
      );

      const res = await request(app)
        .patch("/api/v1/government-ids/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ verificationStatus: "Verified" });

      expect(res.status).toBe(403);
    });
  });
});
