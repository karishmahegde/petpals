const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — staff.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  staff: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  shelter: {
    updateMany: jest.fn(),
  },
  users: {
    update: jest.fn(),
    delete: jest.fn(),
  },
  governmentID: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  adoptionApplication: {
    findFirst: jest.fn(),
  },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Private bucket — never actually hit; every call is asserted, not executed.
jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  uploadPrivateFile: jest.fn().mockResolvedValue(undefined),
  deletePrivateFile: jest.fn().mockResolvedValue(undefined),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check) —
// everything else (assertValidCloseAccountMode, closeAccountMessage,
// nullifyRefreshToken) stays real, since closeMyAccount genuinely exercises
// that shared close-account tail end.
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = (userID = 42) => signToken("Staff", userID);
const adminToken = () => signToken("Admin");

// Matches STAFF_SELF_SELECT in staff.service.js.
const buildStaffProfile = (overrides = {}) => ({
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

const buildGovernmentIdRow = (overrides = {}) => ({
  governmentIDID: 7,
  userID: 42,
  userType: "Staff",
  idType: "Passport",
  idNumber: "AB1234567",
  verificationStatus: "Pending",
  documentURL: "staff/42/id-123.jpg",
  ...overrides,
});

describe("Staff self-service endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /staff/me —————————————————————————————
  describe("GET /api/v1/staff/me", () => {
    test("returns the caller's own profile", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce(buildStaffProfile());

      const res = await request(app)
        .get("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42 } }),
      );
      expect(res.body.data.staffName).toBe("Jordan Rivera");
    });
  });

  // ————————————————————————————— PUT /staff/me —————————————————————————————
  describe("PUT /api/v1/staff/me", () => {
    test("valid partial update → 200, only the sent fields are written", async () => {
      prisma.staff.update.mockResolvedValueOnce(
        buildStaffProfile({ staffName: "Jordan R. Rivera" }),
      );

      const res = await request(app)
        .put("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ staffName: "Jordan R. Rivera" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { staffName: "Jordan R. Rivera" },
        select: expect.any(Object),
      });
      expect(res.body.data.staffName).toBe("Jordan R. Rivera");
    });

    test.each(["shelterID", "staffDesignation", "accountStatus"])(
      "disallowed field '%s' in body → 400 BAD_REQUEST, nothing written",
      async (field) => {
        const res = await request(app)
          .put("/api/v1/staff/me")
          .set("Authorization", `Bearer ${staffToken()}`)
          .send({ [field]: "whatever" });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "BAD_REQUEST" },
        });
        expect(prisma.staff.update).not.toHaveBeenCalled();
      },
    );

    test("no updatable fields provided → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .put("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("invalid staffSex value → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .put("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ staffSex: "X" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });

    test("staffPhone: null clears it (nullable field) → written as null", async () => {
      prisma.staff.update.mockResolvedValueOnce(
        buildStaffProfile({ staffPhone: null }),
      );

      const res = await request(app)
        .put("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ staffPhone: null });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { staffPhone: null } }),
      );
    });

    test("staffName: null (non-nullable field) → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .put("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ staffName: null });

      expect(res.status).toBe(400);
      expect(prisma.staff.update).not.toHaveBeenCalled();
    });
  });

  // ——————————————————— GET /staff/me/government-id ———————————————————
  describe("GET /api/v1/staff/me/government-id", () => {
    test("submitted → masked idNumber returned", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow(),
      );

      const res = await request(app)
        .get("/api/v1/staff/me/government-id")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.idNumber).toBe("*****4567");
      expect(res.body.data.idNumber).not.toBe("AB1234567");
    });

    test("none submitted → 404 NOT_FOUND", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/staff/me/government-id")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ——————————————————— POST /staff/me/government-id ———————————————————
  describe("POST /api/v1/staff/me/government-id", () => {
    const submit = (overrides = {}) =>
      request(app)
        .post("/api/v1/staff/me/government-id")
        .set("Authorization", `Bearer ${staffToken()}`)
        .field("idType", overrides.idType ?? "Passport")
        .field("idNumber", overrides.idNumber ?? "AB1234567")
        .attach(
          "file",
          Buffer.from("fake-id-bytes"),
          overrides.filename ?? "id.jpg",
        );

    test("first submission → 201, stored unmasked, returned masked", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.create.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      expect(prisma.governmentID.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userID: 42,
            userType: "Staff",
            idNumber: "AB1234567", // stored in full — only the response masks it
          }),
        }),
      );
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("duplicate non-Rejected submission → 409 CONFLICT, nothing written", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow({ verificationStatus: "Pending" }),
      );

      const res = await submit({ idNumber: "ZZ9999999" });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "CONFLICT" },
      });
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
    });

    test("existing Rejected submission → resubmit overwrites the same row, resets to Pending", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow({
          governmentIDID: 7,
          verificationStatus: "Rejected",
          documentURL: "staff/42/id-old.jpg",
        }),
      );
      prisma.governmentID.update.mockResolvedValueOnce(
        buildGovernmentIdRow({ verificationStatus: "Pending" }),
      );

      const res = await submit({ idNumber: "CD5551234" });

      expect(res.status).toBe(201);
      expect(prisma.governmentID.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { governmentIDID: 7 },
          data: expect.objectContaining({
            idNumber: "CD5551234",
            verificationStatus: "Pending",
          }),
        }),
      );
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      // Previous file is now orphaned — removed as a best-effort cleanup.
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "government-ids",
        "staff/42/id-old.jpg",
      );
    });

    test("missing file → 400 BAD_REQUEST, nothing written", async () => {
      // Short-circuits in the controller before ever reaching the service's
      // findFirst duplicate-check — nothing to mock for that call here.
      const res = await request(app)
        .post("/api/v1/staff/me/government-id")
        .set("Authorization", `Bearer ${staffToken()}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567");

      expect(res.status).toBe(400);
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— DELETE /staff/me —————————————————————————————
  describe("DELETE /api/v1/staff/me", () => {
    test("mode=deactivate → 200, status set Deactivated, refresh token nulled, managed shelters cleared", async () => {
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);
      prisma.staff.update.mockResolvedValueOnce({});
      prisma.shelter.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.users.update.mockResolvedValueOnce({});

      const res = await request(app)
        .delete("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ mode: "deactivate" });

      expect(res.status).toBe(200);
      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 42 },
          data: { accountStatus: "Deactivated" },
        }),
      );
      expect(prisma.shelter.updateMany).toHaveBeenCalledWith({
        where: { managerStaffID: 42 },
        data: { managerStaffID: null },
      });
      expect(prisma.users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 42 },
          data: { refreshToken: null },
        }),
      );
      expect(prisma.staff.delete).not.toHaveBeenCalled();
    });

    test("mode=delete → 200, staff and users rows removed, government ID cleaned up", async () => {
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);
      prisma.shelter.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.governmentID.findFirst.mockResolvedValueOnce({
        documentURL: "staff/42/id-123.jpg",
      });
      prisma.staff.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await request(app)
        .delete("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(prisma.staff.delete).toHaveBeenCalledWith({
        where: { userID: 42 },
      });
      expect(prisma.users.delete).toHaveBeenCalledWith({
        where: { userID: 42 },
      });
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "government-ids",
        "staff/42/id-123.jpg",
      );
    });

    test("Pending application still assigned → 409 CONFLICT, nothing written", async () => {
      prisma.adoptionApplication.findFirst.mockResolvedValueOnce({
        applicationID: 99,
      });

      const res = await request(app)
        .delete("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ mode: "deactivate" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(prisma.staff.update).not.toHaveBeenCalled();
      expect(prisma.staff.delete).not.toHaveBeenCalled();
    });

    test("invalid mode → 422 VALIDATION_ERROR, nothing written", async () => {
      const res = await request(app)
        .delete("/api/v1/staff/me")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ mode: "wipe" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.staff.update).not.toHaveBeenCalled();
      expect(prisma.staff.delete).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    // /staff/me/* is Staff-only — unlike the pet-management routes, Admin is
    // NOT authorized here either (there's a separate admin-side GET
    // /staff/:id for oversight of someone else's row).
    test.each([
      ["get", "/api/v1/staff/me"],
      ["put", "/api/v1/staff/me"],
      ["delete", "/api/v1/staff/me"],
      ["get", "/api/v1/staff/me/government-id"],
      ["post", "/api/v1/staff/me/government-id"],
    ])("%s %s: Admin role → 403 FORBIDDEN, nothing written", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "FORBIDDEN" },
      });
      expect(prisma.staff.update).not.toHaveBeenCalled();
      expect(prisma.staff.delete).not.toHaveBeenCalled();
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });
  });
});
