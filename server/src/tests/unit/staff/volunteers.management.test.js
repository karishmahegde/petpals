const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  volunteer: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  governmentID: { findUnique: jest.fn(), findMany: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = () => signToken("Staff", 42);
const adminToken = () => signToken("Admin", 1);
const adopterToken = () => signToken("Adopter", 7);

const detailRow = (overrides = {}) => ({
  userID: 30,
  volunteerCode: "VOL-00030",
  avatarSeed: "seed",
  volunteerName: "Val Volunteer",
  volunteerPhone: "+12125550130",
  volunteerDOB: new Date("1995-04-02"),
  volunteerSex: "F",
  volunteerSchedule: "Weekends",
  shelterID: 9,
  createdAt: new Date("2026-08-01"),
  accountStatus: "Active",
  onboardingComplete: true,
  onboardingStep: 5,
  shelter: { shelterName: "Downtown Shelter" },
  user: { userEmail: "val@ex.com" },
  ...overrides,
});

describe("Volunteers (Staff)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/volunteers", () => {
    test("Staff: scoped to own shelter, name-ascending, email flattened, approval readiness attached", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteer.findMany.mockResolvedValueOnce([
        {
          userID: 30,
          volunteerName: "Val Volunteer",
          volunteerPhone: "+12125550130",
          accountStatus: "Pending",
          onboardingComplete: true,
          user: { userEmail: "val@ex.com" },
        },
      ]);
      prisma.volunteer.count.mockResolvedValueOnce(1);
      prisma.governmentID.findMany.mockResolvedValueOnce([
        { userID: 30, verificationStatus: "Pending" },
      ]);

      const res = await request(app)
        .get("/api/v1/volunteers")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.volunteer.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ shelterID: 9 });
      expect(args.orderBy).toEqual({ volunteerName: "asc" });
      expect(res.body.data).toEqual([
        {
          userID: 30,
          volunteerName: "Val Volunteer",
          volunteerPhone: "+12125550130",
          volunteerEmail: "val@ex.com",
          accountStatus: "Pending",
          onboardingComplete: true,
          governmentIdStatus: "Pending",
        },
      ]);
      expect(prisma.governmentID.findMany.mock.calls[0][0].where).toEqual({
        userID: { in: [30] },
        userType: "Volunteer",
      });
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    test("accountStatus + case-insensitive name + pagination", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteer.findMany.mockResolvedValueOnce([]);
      prisma.volunteer.count.mockResolvedValueOnce(12);

      const res = await request(app)
        .get("/api/v1/volunteers")
        .query({ accountStatus: "Pending", name: "val", page: 2, limit: 5 })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.volunteer.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        shelterID: 9,
        accountStatus: "Pending",
        volunteerName: { contains: "val", mode: "insensitive" },
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    test("Staff with no shelter -> sentinel shelterID -1", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(null);
      prisma.volunteer.findMany.mockResolvedValueOnce([]);
      prisma.volunteer.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/volunteers")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(prisma.volunteer.findMany.mock.calls[0][0].where.shelterID).toBe(-1);
    });

    test("Staff: shelterID query param is ignored", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteer.findMany.mockResolvedValueOnce([]);
      prisma.volunteer.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/volunteers")
        .query({ shelterID: 77 })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(prisma.volunteer.findMany.mock.calls[0][0].where.shelterID).toBe(9);
    });

    test("Admin: unscoped by default, shelterID param narrows", async () => {
      prisma.volunteer.findMany.mockResolvedValue([]);
      prisma.volunteer.count.mockResolvedValue(0);

      await request(app)
        .get("/api/v1/volunteers")
        .set("Authorization", `Bearer ${adminToken()}`);
      await request(app)
        .get("/api/v1/volunteers")
        .query({ shelterID: 77 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.volunteer.findMany.mock.calls[0][0].where).toEqual({});
      expect(prisma.volunteer.findMany.mock.calls[1][0].where).toEqual({ shelterID: 77 });
    });

    test.each([
      [{ accountStatus: "Suspended" }, "accountStatus"],
      [{ page: -1 }, "page"],
      [{ limit: 0 }, "limit"],
    ])("invalid %j -> 400", async (query, field) => {
      const res = await request(app)
        .get("/api/v1/volunteers")
        .query(query)
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.volunteer.findMany).not.toHaveBeenCalled();
    });

    test("Admin: invalid shelterID -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/volunteers")
        .query({ shelterID: "0" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
    });

    test("Adopter -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/volunteers")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
    });

    test("no token -> 401", async () => {
      const res = await request(app).get("/api/v1/volunteers");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/volunteers/:id", () => {
    test("own shelter's volunteer -> full profile, shelter/email flattened, government ID attached", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(detailRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.governmentID.findUnique.mockResolvedValueOnce({
        idType: "Passport",
        idNumber: "X1234567",
        verificationStatus: "Verified",
      });

      const res = await request(app)
        .get("/api/v1/volunteers/30")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findUnique).toHaveBeenCalledWith({
        where: { userID_userType: { userID: 30, userType: "Volunteer" } },
        select: { idType: true, idNumber: true, verificationStatus: true },
      });
      expect(res.body.data).toMatchObject({
        userID: 30,
        volunteerName: "Val Volunteer",
        shelterName: "Downtown Shelter",
        volunteerEmail: "val@ex.com",
        onboardingComplete: true,
        onboardingStep: 5,
        governmentID: { idType: "Passport", idNumber: "X1234567" },
        governmentIdStatus: "Verified",
        volunteerSchedule: "Weekends",
        availability: null, // pre-structured free text — only the raw value
      });
      expect(res.body.data).not.toHaveProperty("shelter");
      expect(res.body.data).not.toHaveProperty("user");
    });

    test("no government ID on file -> governmentID null", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(detailRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.governmentID.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/30")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.governmentID).toBeNull();
      expect(res.body.data.governmentIdStatus).toBeNull();
    });

    test("structured availability is returned decoded alongside the raw schedule", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(
        detailRow({ volunteerSchedule: "Mon:M;Sat:AE" }),
      );
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.governmentID.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/30")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.availability).toEqual({
        Mon: ["Morning"],
        Sat: ["Afternoon", "Evening"],
      });
    });

    test("another shelter's volunteer -> 403, government ID never read", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(detailRow({ shelterID: 10 }));
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .get("/api/v1/volunteers/30")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
      expect(prisma.governmentID.findUnique).not.toHaveBeenCalled();
    });

    test("Admin sees any shelter's volunteer", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(detailRow({ shelterID: 10 }));
      prisma.governmentID.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/30")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("unknown id -> 404", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/volunteers/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });

    test("non-numeric id -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/volunteers/abc")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.volunteer.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/v1/volunteers/:id/status", () => {
    test.each([
      ["Pending", "Active"],
      ["Pending", "Deactivated"],
      ["Active", "Deactivated"],
    ])("%s -> %s allowed (onboarded, ID Verified)", async (from, to) => {
      prisma.volunteer.findUnique
        .mockResolvedValueOnce({ shelterID: 9, accountStatus: from, onboardingComplete: true })
        .mockResolvedValueOnce(detailRow({ accountStatus: to }));
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.governmentID.findMany.mockResolvedValue([
        { userID: 30, verificationStatus: "Verified" },
      ]);
      prisma.governmentID.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: to });

      expect(res.status).toBe(200);
      expect(prisma.volunteer.update).toHaveBeenCalledWith({
        where: { userID: 30 },
        data: { accountStatus: to },
      });
      expect(res.body.data.accountStatus).toBe(to);
    });

    test.each([
      ["Active", "Active"],
      ["Deactivated", "Active"],
      ["Deactivated", "Deactivated"],
      ["Banned", "Active"],
      ["Banned", "Deactivated"],
    ])("%s -> %s rejected with 409", async (from, to) => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 9, accountStatus: from });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: to });

      expect(res.status).toBe(409);
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    // Same rule as staff and vet approval (staffApproval.service.js) — 409
    // naming everything still missing.
    test.each([
      [
        "onboarding incomplete, no ID",
        false,
        [],
        "This volunteer can't be approved yet — they haven't finished onboarding and they haven't submitted a government ID",
      ],
      [
        "onboarded, ID still Pending",
        true,
        [{ userID: 30, verificationStatus: "Pending" }],
        "This volunteer can't be approved yet — their government ID is Pending, not Verified",
      ],
      [
        "onboarded, ID Rejected",
        true,
        [{ userID: 30, verificationStatus: "Rejected" }],
        "This volunteer can't be approved yet — their government ID is Rejected, not Verified",
      ],
      [
        "ID Verified but onboarding incomplete",
        false,
        [{ userID: 30, verificationStatus: "Verified" }],
        "This volunteer can't be approved yet — they haven't finished onboarding",
      ],
    ])("approve blocked (%s) -> 409, nothing written", async (_label, onboardingComplete, ids, message) => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({
        shelterID: 9,
        accountStatus: "Pending",
        onboardingComplete,
      });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.governmentID.findMany.mockResolvedValueOnce(ids);

      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.message).toBe(message);
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test("decline: Pending -> Deactivated is allowed mid-onboarding with no ID", async () => {
      prisma.volunteer.findUnique
        .mockResolvedValueOnce({ shelterID: 9, accountStatus: "Pending", onboardingComplete: false })
        .mockResolvedValueOnce(detailRow({ accountStatus: "Deactivated", onboardingComplete: false }));
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.governmentID.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findMany).not.toHaveBeenCalled();
      expect(prisma.volunteer.update).toHaveBeenCalledWith({
        where: { userID: 30 },
        data: { accountStatus: "Deactivated" },
      });
    });

    test("another shelter's volunteer -> 403", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce({ shelterID: 10, accountStatus: "Pending" });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(403);
      expect(prisma.volunteer.update).not.toHaveBeenCalled();
    });

    test("unknown id -> 404", async () => {
      prisma.volunteer.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/volunteers/999/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(404);
    });

    test.each([undefined, "Banned", "Pending"])("accountStatus %s -> 400", async (accountStatus) => {
      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ accountStatus });

      expect(res.status).toBe(400);
      expect(prisma.volunteer.findUnique).not.toHaveBeenCalled();
    });

    test("Adopter -> 403", async () => {
      const res = await request(app)
        .patch("/api/v1/volunteers/30/status")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(403);
    });
  });
});
