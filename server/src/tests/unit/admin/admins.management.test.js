const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  admin: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
  $transaction: jest.fn(),
}));

// Private bucket — never actually hit; every call is asserted, not executed.
jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  uploadPrivateFile: jest.fn(),
  deletePrivateFile: jest.fn(),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check) —
// the close-account helpers stay real.
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const storage = require("../../../services/storage");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 1) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = (userID = 1) => signToken("Admin", userID);
const staffToken = () => signToken("Staff", 42);

// Matches ADMIN_LIST_SELECT in admins.service.js.
const buildAdminRow = (overrides = {}) => ({
  userID: 2,
  avatarSeed: "seed-2",
  adminName: "Avery Admin",
  adminPhone: "+12125550102",
  addressLine1: "",
  addressLine2: null,
  city: "",
  state: "",
  zip: "",
  country: "",
  adminDOB: null,
  adminSex: null,
  createdAt: new Date("2026-08-01"),
  accountStatus: "Active",
  statusChangedAt: null,
  user: {
    userEmail: "avery@petpals.org",
    emailVerified: true,
    lastLoginAt: new Date("2026-09-20"),
  },
  statusChangedBy: null,
  ...overrides,
});

const buildGovernmentIdRow = (overrides = {}) => ({
  governmentIDID: 7,
  userID: 1,
  userType: "Admin",
  idType: "Passport",
  idNumber: "AB1234567",
  verificationStatus: "Pending",
  documentURL: "admin/1/id-123.jpg",
  ...overrides,
});

describe("Admin accounts", () => {
  beforeEach(() => {
    // resetAllMocks (not clear) so a failing test's unconsumed *Once values
    // can't leak into the next test.
    jest.resetAllMocks();
    // The service always passes an array of already-invoked prisma calls
    // (each already a Promise) — Promise.all is a faithful enough stand-in.
    prisma.$transaction.mockImplementation((operations) => Promise.all(operations));
    authService.getAccountStatus.mockResolvedValue("Active");
    storage.uploadPrivateFile.mockResolvedValue(undefined);
    storage.deletePrivateFile.mockResolvedValue(undefined);
  });

  // ————————————————————————————— GET /admins —————————————————————————————
  describe("GET /api/v1/admins", () => {
    test("name-ascending, paginated, login fields flattened and email kept nested", async () => {
      prisma.admin.findMany.mockResolvedValueOnce([buildAdminRow()]);
      prisma.admin.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/admins")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.admin.findMany.mock.calls[0][0];
      expect(args.where).toEqual({});
      expect(args.orderBy).toEqual({ adminName: "asc" });
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);

      const [admin] = res.body.data;
      expect(admin.user).toEqual({ userEmail: "avery@petpals.org" });
      expect(admin.emailVerified).toBe(true);
      expect(admin.lastLoginAt).toBe("2026-09-20T00:00:00.000Z");
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    test("the select never reaches userPassword/refreshToken", async () => {
      prisma.admin.findMany.mockResolvedValueOnce([]);
      prisma.admin.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/admins")
        .set("Authorization", `Bearer ${adminToken()}`);

      const { select } = prisma.admin.findMany.mock.calls[0][0];
      expect(select.user).toEqual({
        select: { userEmail: true, emailVerified: true, lastLoginAt: true },
      });
    });

    test("accountStatus filter + pagination", async () => {
      prisma.admin.findMany.mockResolvedValueOnce([]);
      prisma.admin.count.mockResolvedValueOnce(41);

      const res = await request(app)
        .get("/api/v1/admins")
        .query({ accountStatus: "Pending", page: 3, limit: 20 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.admin.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ accountStatus: "Pending" });
      expect(args.skip).toBe(40);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    test.each([
      [{ accountStatus: "Banned" }, "accountStatus"],
      [{ page: 0 }, "page"],
      [{ limit: 101 }, "limit"],
      [{ limit: "abc" }, "limit"],
    ])("invalid %j -> 400", async (query, field) => {
      const res = await request(app)
        .get("/api/v1/admins")
        .query(query)
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.admin.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /admins/:id —————————————————————————————
  describe("GET /api/v1/admins/:id", () => {
    test("found -> 200 with the changer's name attached", async () => {
      prisma.admin.findUnique.mockResolvedValueOnce(
        buildAdminRow({
          statusChangedAt: new Date("2026-09-01"),
          statusChangedBy: { userID: 1, adminName: "Root Admin" },
        }),
      );

      const res = await request(app)
        .get("/api/v1/admins/2")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.admin.findUnique.mock.calls[0][0].where).toEqual({ userID: 2 });
      expect(res.body.data.statusChangedBy).toEqual({ userID: 1, adminName: "Root Admin" });
    });

    test("unknown id -> 404", async () => {
      prisma.admin.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/admins/999")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
    });

    test.each(["abc", "0", "-3"])("id %s -> 400", async (id) => {
      const res = await request(app)
        .get(`/api/v1/admins/${id}`)
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.admin.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————— PATCH /admins/:id/status —————————————————————————
  describe("PATCH /api/v1/admins/:id/status", () => {
    test.each(["Active", "Deactivated"])(
      "-> %s: written with the acting admin as statusChangedBy",
      async (accountStatus) => {
        prisma.admin.update.mockResolvedValueOnce({});
        prisma.admin.findUnique.mockResolvedValueOnce(buildAdminRow({ accountStatus }));

        const res = await request(app)
          .patch("/api/v1/admins/2/status")
          .set("Authorization", `Bearer ${adminToken(1)}`)
          .send({ accountStatus });

        expect(res.status).toBe(200);
        const { where, data } = prisma.admin.update.mock.calls[0][0];
        expect(where).toEqual({ userID: 2 });
        expect(data.accountStatus).toBe(accountStatus);
        expect(data.statusChangedByID).toBe(1);
        expect(data.statusChangedAt).toBeInstanceOf(Date);
        expect(res.body.data.accountStatus).toBe(accountStatus);
      },
    );

    test("deactivating yourself -> 400, nothing written", async () => {
      const res = await request(app)
        .patch("/api/v1/admins/1/status")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .send({ accountStatus: "Deactivated" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/your own account/);
      expect(prisma.admin.update).not.toHaveBeenCalled();
    });

    test("setting yourself Active is allowed (only self-deactivation is blocked)", async () => {
      prisma.admin.update.mockResolvedValueOnce({});
      prisma.admin.findUnique.mockResolvedValueOnce(buildAdminRow({ userID: 1 }));

      const res = await request(app)
        .patch("/api/v1/admins/1/status")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(200);
    });

    test("unknown id (Prisma P2025) -> 404", async () => {
      prisma.admin.update.mockRejectedValueOnce(Object.assign(new Error("nope"), { code: "P2025" }));

      const res = await request(app)
        .patch("/api/v1/admins/999/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(404);
    });

    test("any other DB error -> 500", async () => {
      prisma.admin.update.mockRejectedValueOnce(new Error("connection lost"));

      const res = await request(app)
        .patch("/api/v1/admins/2/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(500);
    });

    test.each([undefined, "Pending", "Banned"])("accountStatus %s -> 400", async (accountStatus) => {
      const res = await request(app)
        .patch("/api/v1/admins/2/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus });

      expect(res.status).toBe(400);
      expect(prisma.admin.update).not.toHaveBeenCalled();
    });

    test("invalid id -> 400", async () => {
      const res = await request(app)
        .patch("/api/v1/admins/abc/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Active" });

      expect(res.status).toBe(400);
    });
  });

  // ————————————————————————————— GET /admins/me —————————————————————————————
  describe("GET /api/v1/admins/me", () => {
    test("returns the caller's own profile (not matched as /admins/:id)", async () => {
      prisma.admin.findUnique.mockResolvedValueOnce(buildAdminRow({ userID: 1 }));

      const res = await request(app)
        .get("/api/v1/admins/me")
        .set("Authorization", `Bearer ${adminToken(1)}`);

      expect(res.status).toBe(200);
      expect(prisma.admin.findUnique.mock.calls[0][0].where).toEqual({ userID: 1 });
      expect(res.body.data.userID).toBe(1);
    });
  });

  // ————————————————————————————— PUT /admins/me —————————————————————————————
  describe("PUT /api/v1/admins/me", () => {
    const put = (body) =>
      request(app)
        .put("/api/v1/admins/me")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .send(body);

    test("valid partial update -> only sent fields written, phone normalized, DOB parsed, address trimmed", async () => {
      prisma.admin.update.mockResolvedValueOnce(buildAdminRow({ userID: 1 }));

      const res = await put({
        adminName: "Avery A.",
        adminPhone: "+1 (212) 555-0199",
        adminDOB: "1990-05-01",
        adminSex: "F",
        city: "  Brooklyn  ",
      });

      expect(res.status).toBe(200);
      const { where, data } = prisma.admin.update.mock.calls[0][0];
      expect(where).toEqual({ userID: 1 });
      expect(data).toEqual({
        adminName: "Avery A.",
        adminPhone: "+12125550199",
        adminDOB: new Date("1990-05-01"),
        adminSex: "F",
        city: "Brooklyn",
      });
    });

    test.each(["adminPhone", "adminDOB", "adminSex"])(
      "%s: null clears it (nullable field)",
      async (field) => {
        prisma.admin.update.mockResolvedValueOnce(buildAdminRow({ userID: 1 }));

        const res = await put({ [field]: null });

        expect(res.status).toBe(200);
        expect(prisma.admin.update.mock.calls[0][0].data).toEqual({ [field]: null });
      },
    );

    test.each([
      [{ accountStatus: "Active" }, 400, "cannot be updated here"],
      [{}, 400, "No updatable fields"],
      [{ unknownField: "x" }, 400, "No updatable fields"],
      [{ adminName: null }, 400, "adminName cannot be empty"],
      [{ avatarSeed: null }, 400, "avatarSeed cannot be empty"],
      [{ adminName: "   " }, 400, "adminName cannot be empty"],
      [{ adminName: "x".repeat(46) }, 400, "45 characters"],
      [{ avatarSeed: "x".repeat(65) }, 400, "64 characters"],
      [{ adminSex: "X" }, 400, "adminSex must be one of"],
      [{ adminDOB: "not-a-date" }, 400, "adminDOB must be a valid date"],
      [{ adminPhone: "12345" }, 422, "phone must be a valid phone number"],
      [{ city: 42 }, 400, "city must be a string"],
    ])("invalid body %j -> %i, nothing written", async (body, status, message) => {
      const res = await put(body);

      expect(res.status).toBe(status);
      expect(res.body.message).toContain(message);
      expect(prisma.admin.update).not.toHaveBeenCalled();
    });

    test("caller's row gone (P2025) -> 404", async () => {
      prisma.admin.update.mockRejectedValueOnce(Object.assign(new Error("nope"), { code: "P2025" }));

      const res = await put({ adminName: "Avery" });

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————————— DELETE /admins/me —————————————————————————————
  describe("DELETE /api/v1/admins/me", () => {
    const close = (mode) =>
      request(app)
        .delete("/api/v1/admins/me")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .send({ mode });

    test("mode=deactivate -> row kept, Deactivated by self, refresh token nulled", async () => {
      prisma.admin.update.mockResolvedValueOnce({});
      prisma.users.update.mockResolvedValueOnce({});

      const res = await close("deactivate");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deactivated");
      const { where, data } = prisma.admin.update.mock.calls[0][0];
      expect(where).toEqual({ userID: 1 });
      expect(data).toMatchObject({ accountStatus: "Deactivated", statusChangedByID: 1 });
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { userID: 1 },
        data: { refreshToken: null },
      });
      expect(prisma.admin.delete).not.toHaveBeenCalled();
    });

    test("mode=delete -> government ID, admin and users rows removed, stored file deleted after", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce({ documentURL: "admin/1/id-123.jpg" });
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 1 });
      prisma.admin.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close("delete");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deleted");
      expect(prisma.governmentID.deleteMany).toHaveBeenCalledWith({
        where: { userID: 1, userType: "Admin" },
      });
      expect(prisma.admin.delete).toHaveBeenCalledWith({ where: { userID: 1 } });
      expect(prisma.users.delete).toHaveBeenCalledWith({ where: { userID: 1 } });
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "government-ids",
        "admin/1/id-123.jpg",
      );
    });

    test("mode=delete with no government ID -> no storage call", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 0 });
      prisma.admin.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close("delete");

      expect(res.status).toBe(200);
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
    });

    test.each([undefined, "purge"])("mode %s -> 422, nothing written", async (mode) => {
      const res = await close(mode);

      expect(res.status).toBe(422);
      expect(prisma.admin.update).not.toHaveBeenCalled();
      expect(prisma.admin.delete).not.toHaveBeenCalled();
    });
  });

  // ————————————————————— GET /admins/me/government-id —————————————————————
  describe("GET /api/v1/admins/me/government-id", () => {
    test("submitted -> idNumber masked to the last 4", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await request(app)
        .get("/api/v1/admins/me/government-id")
        .set("Authorization", `Bearer ${adminToken(1)}`);

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst.mock.calls[0][0].where).toEqual({
        userID: 1,
        userType: "Admin",
      });
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("none submitted -> 404", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/admins/me/government-id")
        .set("Authorization", `Bearer ${adminToken(1)}`);

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————— POST /admins/me/government-id —————————————————————
  describe("POST /api/v1/admins/me/government-id", () => {
    const submit = (overrides = {}) =>
      request(app)
        .post("/api/v1/admins/me/government-id")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .field("idType", overrides.idType ?? "Passport")
        .field("idNumber", overrides.idNumber ?? "AB1234567")
        .attach("file", Buffer.from("fake-id-bytes"), overrides.filename ?? "id.pdf");

    test("first submission -> 201, uploaded under admin/<id>/, stored unmasked, returned masked", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.create.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      const [bucket, objectPath, , mimetype] = storage.uploadPrivateFile.mock.calls[0];
      expect(bucket).toBe("government-ids");
      expect(objectPath).toMatch(/^admin\/1\/id-\d+\.pdf$/);
      expect(mimetype).toBe("application/pdf");
      expect(prisma.governmentID.create.mock.calls[0][0].data).toMatchObject({
        userID: 1,
        userType: "Admin",
        idType: "Passport",
        idNumber: "AB1234567",
        documentURL: objectPath,
      });
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("fields are trimmed before saving", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.create.mockResolvedValueOnce(buildGovernmentIdRow());

      await submit({ idType: "  Passport  ", idNumber: "  AB1234567  " });

      expect(prisma.governmentID.create.mock.calls[0][0].data).toMatchObject({
        idType: "Passport",
        idNumber: "AB1234567",
      });
    });

    test.each(["Pending", "Verified"])(
      "existing %s submission -> 409, nothing uploaded or written",
      async (verificationStatus) => {
        prisma.governmentID.findFirst.mockResolvedValueOnce(
          buildGovernmentIdRow({ verificationStatus }),
        );

        const res = await submit();

        expect(res.status).toBe(409);
        expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
        expect(prisma.governmentID.create).not.toHaveBeenCalled();
        expect(prisma.governmentID.update).not.toHaveBeenCalled();
      },
    );

    test("existing Rejected submission -> resubmit overwrites the same row, back to Pending", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow({ verificationStatus: "Rejected" }),
      );
      prisma.governmentID.update.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      const { where, data } = prisma.governmentID.update.mock.calls[0][0];
      expect(where).toEqual({ governmentIDID: 7 });
      expect(data.verificationStatus).toBe("Pending");
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });

    test.each([
      [{ idType: "" }, "idType"],
      [{ idType: "x".repeat(46) }, "idType"],
      [{ idNumber: "   " }, "idNumber"],
      [{ idNumber: "x".repeat(46) }, "idNumber"],
    ])("invalid fields %j -> 400", async (overrides, field) => {
      const res = await submit(overrides);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
    });

    test("missing file -> 400", async () => {
      const res = await request(app)
        .post("/api/v1/admins/me/government-id")
        .set("Authorization", `Bearer ${adminToken(1)}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/document file is required/);
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
    });

    test("storage upload fails -> 500, no DB row written", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      storage.uploadPrivateFile.mockRejectedValueOnce(new Error("bucket unavailable"));

      const res = await submit();

      expect(res.status).toBe(500);
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— role enforcement —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/admins"],
      ["get", "/api/v1/admins/2"],
      ["patch", "/api/v1/admins/2/status"],
      ["get", "/api/v1/admins/me"],
      ["put", "/api/v1/admins/me"],
      ["delete", "/api/v1/admins/me"],
      ["get", "/api/v1/admins/me/government-id"],
      ["post", "/api/v1/admins/me/government-id"],
    ])("Staff: %s %s -> 403", async (method, url) => {
      const res = await request(app)[method](url).set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("no token -> 401", async () => {
      const res = await request(app).get("/api/v1/admins");

      expect(res.status).toBe(401);
    });

    test("a Deactivated admin's still-valid token -> 401 (live account check)", async () => {
      authService.getAccountStatus.mockResolvedValue("Deactivated");

      const res = await request(app)
        .get("/api/v1/admins")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(401);
      expect(prisma.admin.findMany).not.toHaveBeenCalled();
    });
  });
});
