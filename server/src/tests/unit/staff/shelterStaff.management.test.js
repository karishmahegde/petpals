const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  shelter: { findFirst: jest.fn() },
  staff: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
  governmentID: { findMany: jest.fn() },
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
    // No government IDs on file unless a test says otherwise.
    prisma.governmentID.findMany.mockResolvedValue([]);
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

    test("section=pending lists Pending registrations, minus Manager sign-ups (Admin's)", async () => {
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
        OR: [
          { staffDesignation: null },
          { staffDesignation: { not: "Manager" } },
        ],
      });
    });

    test("each pending member carries onboardingComplete and their ID's status (one ID lookup for the page)", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findMany.mockResolvedValueOnce([
        memberRow({ userID: 50, accountStatus: "Pending", onboardingComplete: true }),
        memberRow({ userID: 51, accountStatus: "Pending", onboardingComplete: false }),
      ]);
      prisma.staff.count.mockResolvedValueOnce(2);
      prisma.governmentID.findMany.mockResolvedValueOnce([
        { userID: 50, verificationStatus: "Pending" },
      ]);

      const res = await request(app)
        .get("/api/v1/staff/me/team")
        .query({ section: "pending" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.governmentID.findMany.mock.calls[0][0].where).toEqual({
        userID: { in: [50, 51] },
        userType: "Staff",
      });
      expect(
        res.body.data.map(({ userID, onboardingComplete, governmentIdStatus }) => ({
          userID,
          onboardingComplete,
          governmentIdStatus,
        })),
      ).toEqual([
        { userID: 50, onboardingComplete: true, governmentIdStatus: "Pending" },
        { userID: 51, onboardingComplete: false, governmentIdStatus: null },
      ]);
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
    const pendingMember = (overrides = {}) => ({
      shelterID: 9,
      staffDesignation: null,
      accountStatus: "Pending",
      staffDOJ: null,
      onboardingComplete: true,
      ...overrides,
    });

    test("approve: Pending -> Active sets the designation and joining date", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(pendingMember());
      // Approval requires a Verified government ID (staffApproval.service.js).
      prisma.governmentID.findMany.mockResolvedValueOnce([
        { userID: 50, verificationStatus: "Verified" },
      ]);
      prisma.staff.update.mockResolvedValueOnce(memberRow());

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active", staffDesignation: "Senior" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            accountStatus: "Active",
            staffDOJ: expect.any(Date),
            staffDOS: null,
            staffDesignation: "Senior",
          },
        }),
      );
    });

    test("approve without a designation → 400, nothing written", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(pendingMember());

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(400);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    // Approving needs onboarding complete AND a Verified government ID
    // (staffApproval.service.js) — otherwise 409 naming what's missing.
    test.each([
      ["onboarding unfinished (ID Verified)", { onboardingComplete: false }, "Verified", "they haven't finished onboarding"],
      ["no government ID submitted", {}, null, "they haven't submitted a government ID"],
      ["government ID still Pending", {}, "Pending", "their government ID is Pending, not Verified"],
      ["government ID Rejected", {}, "Rejected", "their government ID is Rejected, not Verified"],
    ])("approve blocked — %s → 409, nothing written", async (_label, overrides, idStatus, reason) => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(pendingMember(overrides));
      prisma.governmentID.findMany.mockResolvedValueOnce(
        idStatus ? [{ userID: 50, verificationStatus: idStatus }] : [],
      );

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active", staffDesignation: "Senior" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.message).toBe(
        `This staff member can't be approved yet — ${reason}`,
      );
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("approve blocked by both at once → 409 naming both", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(
        pendingMember({ onboardingComplete: false }),
      );
      prisma.governmentID.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active", staffDesignation: "Senior" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "This staff member can't be approved yet — they haven't finished onboarding and they haven't submitted a government ID",
      );
    });

    test("decline is allowed even before onboarding is done or the ID is verified", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(
        pendingMember({ onboardingComplete: false }),
      );
      prisma.staff.update.mockResolvedValueOnce(
        memberRow({ accountStatus: "Deactivated" }),
      );

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { accountStatus: "Deactivated" } }),
      );
    });

    test("decline needs no designation", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(pendingMember());
      prisma.staff.update.mockResolvedValueOnce(
        memberRow({ accountStatus: "Deactivated" }),
      );

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { accountStatus: "Deactivated" } }),
      );
    });

    test("a Pending Manager sign-up is Admin's → 403", async () => {
      prisma.shelter.findFirst.mockResolvedValueOnce({ shelterID: 9 });
      prisma.staff.findUnique.mockResolvedValueOnce(
        pendingMember({ staffDesignation: "Manager" }),
      );

      const res = await request(app)
        .patch("/api/v1/staff/me/team/50/status")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ accountStatus: "Active", staffDesignation: "Senior" });

      expect(res.status).toBe(403);
      expect(prisma.staff.update).not.toHaveBeenCalled();
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
