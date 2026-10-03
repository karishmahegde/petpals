const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — vets.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  veterinarian: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  governmentID: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  appointment: { findFirst: jest.fn() },
  users: { update: jest.fn(), delete: jest.fn() },
  // The service passes an array of already-invoked prisma calls (each a
  // Promise) — Promise.all is a faithful enough stand-in.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Private bucket — never actually hit; every call is asserted, not executed.
jest.mock("../../../services/storage", () => ({
  GOVERNMENT_IDS_BUCKET: "government-ids",
  uploadPrivateFile: jest.fn().mockResolvedValue(undefined),
  deletePrivateFile: jest.fn().mockResolvedValue(undefined),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
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
const vetToken = (userID = 42) => signToken("Veterinarian", userID);

// Matches VET_SELF_SELECT in vets.service.js.
const buildVetProfile = (overrides = {}) => ({
  userID: 42,
  avatarSeed: "seed-42",
  vetName: "Sam Patel",
  vetPhone: "+12125550119",
  shelterID: 5,
  vetDOB: "1985-03-14T00:00:00.000Z",
  vetSex: "M",
  createdAt: "2026-09-01T00:00:00.000Z",
  accountStatus: "Active",
  onboardingComplete: true,
  onboardingStep: 5,
  shelter: { shelterName: "PetPals Downtown" },
  user: { userEmail: "sam@petpals.org", emailVerified: true, lastLoginAt: null },
  ...overrides,
});

const buildGovernmentIdRow = (overrides = {}) => ({
  governmentIDID: 9,
  userID: 42,
  userType: "Veterinarian",
  idType: "Passport",
  idNumber: "AB1234567",
  verificationStatus: "Pending",
  documentURL: "vet/42/id-123.jpg",
  ...overrides,
});

describe("Veterinarian self-service endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /vets/me —————————————————————————————
  describe("GET /api/v1/vets/me", () => {
    test("returns the caller's own profile, email nested and login fields lifted", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce(buildVetProfile());

      const res = await request(app)
        .get("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42 } }),
      );
      expect(res.body.data).toMatchObject({
        vetName: "Sam Patel",
        emailVerified: true,
        user: { userEmail: "sam@petpals.org" },
      });
    });

    test("no veterinarian row → 404 NOT_FOUND", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ————————————————————————————— PUT /vets/me —————————————————————————————
  describe("PUT /api/v1/vets/me", () => {
    const put = (body) =>
      request(app)
        .put("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`)
        .send(body);

    test("valid partial update → 200, only the sent fields are written", async () => {
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ vetName: "Sam R. Patel" }),
      );

      const res = await put({ vetName: "Sam R. Patel" });

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { vetName: "Sam R. Patel" },
        select: expect.any(Object),
      });
    });

    test("personal + address fields together → all written, DOB parsed, address trimmed", async () => {
      prisma.veterinarian.update.mockResolvedValueOnce(buildVetProfile());

      const res = await put({
        vetDOB: "1985-03-14",
        vetSex: "F",
        addressLine1: " 1 Main St ",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "United States",
      });

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update.mock.calls[0][0].data).toEqual({
        vetDOB: new Date("1985-03-14"),
        vetSex: "F",
        addressLine1: "1 Main St",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "United States",
      });
    });

    test("vetPhone is stored normalised to E.164", async () => {
      prisma.veterinarian.update.mockResolvedValueOnce(buildVetProfile());

      const res = await put({ vetPhone: "+1 (212) 555-0119" });

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vetPhone: "+12125550119" } }),
      );
    });

    test("unparseable vetPhone → 422 VALIDATION_ERROR, nothing written", async () => {
      const res = await put({ vetPhone: "not-a-phone" });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
    });

    test.each(["shelterID", "accountStatus"])(
      "disallowed field '%s' in body → 400 BAD_REQUEST, nothing written",
      async (field) => {
        const res = await put({ vetName: "Sam", [field]: "whatever" });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "BAD_REQUEST" },
        });
        expect(prisma.veterinarian.update).not.toHaveBeenCalled();
      },
    );

    test.each([
      ["no updatable fields", {}],
      ["invalid vetSex", { vetSex: "X" }],
      ["invalid vetDOB", { vetDOB: "not-a-date" }],
      ["vetName over 45 chars", { vetName: "x".repeat(46) }],
      ["vetName: null (non-nullable)", { vetName: null }],
      ["zip over 10 chars", { zip: "12345678901" }],
    ])("%s → 400 BAD_REQUEST, nothing written", async (_label, body) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
    });

    test("vetPhone: null clears it (nullable field) → written as null", async () => {
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ vetPhone: null }),
      );

      const res = await put({ vetPhone: null });

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vetPhone: null } }),
      );
    });
  });

  // ——————————————————— GET /vets/me/government-id ———————————————————
  describe("GET /api/v1/vets/me/government-id", () => {
    test("submitted → masked idNumber returned", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await request(app)
        .get("/api/v1/vets/me/government-id")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42, userType: "Veterinarian" } }),
      );
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("none submitted → 404 NOT_FOUND", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/vets/me/government-id")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ——————————————————— POST /vets/me/government-id ———————————————————
  describe("POST /api/v1/vets/me/government-id", () => {
    const submit = () =>
      request(app)
        .post("/api/v1/vets/me/government-id")
        .set("Authorization", `Bearer ${vetToken()}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567")
        .attach("file", Buffer.from("fake-id-bytes"), "id.jpg");

    test("first submission → 201, stored unmasked under vet/, returned masked", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.create.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      expect(storage.uploadPrivateFile).toHaveBeenCalledWith(
        "government-ids",
        expect.stringMatching(/^vet\/42\/id-\d+\.jpg$/),
        expect.any(Buffer),
        "image/jpeg",
      );
      expect(prisma.governmentID.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userID: 42,
            userType: "Veterinarian",
            idNumber: "AB1234567", // stored in full — only the response masks it
          }),
        }),
      );
      expect(res.body.data.idNumber).toBe("*****4567");
    });

    test("duplicate non-Rejected submission → 409 CONFLICT, nothing written", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      expect(prisma.governmentID.update).not.toHaveBeenCalled();
    });

    test("existing Rejected submission → resubmit overwrites the same row, resets to Pending, old file removed", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(
        buildGovernmentIdRow({
          verificationStatus: "Rejected",
          documentURL: "vet/42/id-old.jpg",
        }),
      );
      prisma.governmentID.update.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await submit();

      expect(res.status).toBe(201);
      expect(prisma.governmentID.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { governmentIDID: 9 },
          data: expect.objectContaining({ verificationStatus: "Pending" }),
        }),
      );
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
      expect(storage.deletePrivateFile).toHaveBeenCalledWith(
        "government-ids",
        "vet/42/id-old.jpg",
      );
    });

    test("missing file → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .post("/api/v1/vets/me/government-id")
        .set("Authorization", `Bearer ${vetToken()}`)
        .field("idType", "Passport")
        .field("idNumber", "AB1234567");

      expect(res.status).toBe(400);
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /vets/me/onboarding-step —————————————————————————————
  describe("PATCH /api/v1/vets/me/onboarding-step", () => {
    const advance = (step) =>
      request(app)
        .patch("/api/v1/vets/me/onboarding-step")
        .set("Authorization", `Bearer ${vetToken()}`)
        .send({ step });

    test.each([
      ["advances to the next step", 2, 2, 3],
      ["never moves backward", 4, 2, 4],
      ["stops at the last step (5)", 5, 5, 5],
    ])("%s (at %i, completed %i → %i)", async (_label, current, step, expected) => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ onboardingStep: current });
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ onboardingStep: expected }),
      );

      const res = await advance(step);

      expect(res.status).toBe(200);
      expect(prisma.veterinarian.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userID: 42 },
          data: { onboardingStep: expected },
        }),
      );
    });

    test.each([1, 6, "abc", undefined])(
      "step %p → 400 BAD_REQUEST, nothing read or written",
      async (step) => {
        const res = await advance(step);

        expect(res.status).toBe(400);
        expect(prisma.veterinarian.findUnique).not.toHaveBeenCalled();
        expect(prisma.veterinarian.update).not.toHaveBeenCalled();
      },
    );
  });

  // ————————————————————————————— PATCH /vets/me/onboarding-complete —————————————————————————————
  describe("PATCH /api/v1/vets/me/onboarding-complete", () => {
    const complete = () =>
      request(app)
        .patch("/api/v1/vets/me/onboarding-complete")
        .set("Authorization", `Bearer ${vetToken()}`);

    const filledIn = {
      vetPhone: "+12125550119",
      vetDOB: new Date("1985-03-14"),
      vetSex: "M",
      addressLine1: "1 Main St",
      city: "New York",
      state: "New York",
      zip: "10001",
      country: "United States",
    };

    test("everything filled in and an ID submitted → 200, onboarding marked complete at step 5", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce(filledIn);
      prisma.governmentID.findFirst.mockResolvedValueOnce({ governmentIDID: 9 });
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ onboardingComplete: true, onboardingStep: 5 }),
      );

      const res = await complete();

      expect(res.status).toBe(200);
      expect(prisma.governmentID.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42, userType: "Veterinarian" } }),
      );
      expect(prisma.veterinarian.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onboardingComplete: true, onboardingStep: 5 },
        }),
      );
    });

    test("missing fields and no ID → 409 naming each one, nothing written", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        ...filledIn,
        vetPhone: null,
        addressLine1: "",
        zip: "",
      });
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Phone, Address line 1, ZIP, Government ID",
      );
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
    });

    test("only the government ID missing → 409 naming just that", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce(filledIn);
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Government ID",
      );
    });
  });

  // ————————————————————————————— PENDING VET (onboarding before approval) —————————————————————————————
  describe("a Pending veterinarian", () => {
    beforeEach(() => {
      authService.getAccountStatus.mockResolvedValue("Pending");
    });

    test("can read their own profile", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce(
        buildVetProfile({ accountStatus: "Pending", onboardingComplete: false }),
      );

      const res = await request(app)
        .get("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(200);
    });

    test("can save their profile", async () => {
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ accountStatus: "Pending" }),
      );

      const res = await request(app)
        .put("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`)
        .send({ vetSex: "M" });

      expect(res.status).toBe(200);
    });

    test("can save a wizard step", async () => {
      prisma.veterinarian.findUnique.mockResolvedValueOnce({ onboardingStep: 2 });
      prisma.veterinarian.update.mockResolvedValueOnce(
        buildVetProfile({ accountStatus: "Pending", onboardingStep: 3 }),
      );

      const res = await request(app)
        .patch("/api/v1/vets/me/onboarding-step")
        .set("Authorization", `Bearer ${vetToken()}`)
        .send({ step: 2 });

      expect(res.status).toBe(200);
    });

    test("can check their government ID", async () => {
      prisma.governmentID.findFirst.mockResolvedValueOnce(buildGovernmentIdRow());

      const res = await request(app)
        .get("/api/v1/vets/me/government-id")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(200);
    });

    test("is blocked from a plain-authenticate route → 401", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/me")
        .set("Authorization", `Bearer ${vetToken()}`);

      expect(res.status).toBe(401);
    });
  });

  // ————————————————————————————— DELETE /vets/me —————————————————————————————
  describe("DELETE /api/v1/vets/me", () => {
    const close = (body) =>
      request(app)
        .delete("/api/v1/vets/me")
        .set("Authorization", `Bearer ${vetToken()}`)
        .send(body);

    test("mode=deactivate → 200, status Deactivated, refresh token nulled, nothing deleted", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.veterinarian.update.mockResolvedValueOnce({});
      prisma.users.update.mockResolvedValueOnce({});

      const res = await close({ mode: "deactivate" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deactivated");
      expect(prisma.veterinarian.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { accountStatus: "Deactivated" },
      });
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { refreshToken: null },
      });
      expect(prisma.veterinarian.delete).not.toHaveBeenCalled();
      expect(prisma.governmentID.deleteMany).not.toHaveBeenCalled();
    });

    test("mode=delete → 200, vet + users rows and government ID removed, then its stored file", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.findFirst.mockResolvedValueOnce({ documentURL: "vet/42/id-1.jpg" });
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 1 });
      prisma.veterinarian.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deleted");
      expect(prisma.governmentID.deleteMany).toHaveBeenCalledWith({
        where: { userID: 42, userType: "Veterinarian" },
      });
      expect(prisma.veterinarian.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(prisma.users.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(storage.deletePrivateFile).toHaveBeenCalledWith("government-ids", "vet/42/id-1.jpg");
    });

    test("mode=delete with no government ID → nothing to remove from storage", async () => {
      prisma.appointment.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);
      prisma.governmentID.deleteMany.mockResolvedValueOnce({ count: 0 });
      prisma.veterinarian.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(storage.deletePrivateFile).not.toHaveBeenCalled();
    });

    test.each(["deactivate", "delete"])(
      "upcoming Scheduled appointments → 409 for mode=%s, nothing written",
      async (mode) => {
        prisma.appointment.findFirst.mockResolvedValueOnce({ appointmentID: 11 });

        const res = await close({ mode });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("CONFLICT");
        expect(prisma.appointment.findFirst.mock.calls[0][0].where).toEqual({
          vetID: 42,
          appointmentStatus: "Scheduled",
          appointmentDate: { gt: expect.any(Date) },
        });
        expect(prisma.veterinarian.update).not.toHaveBeenCalled();
        expect(prisma.veterinarian.delete).not.toHaveBeenCalled();
        expect(prisma.users.delete).not.toHaveBeenCalled();
      },
    );

    test.each([undefined, "archive"])(
      "mode %p → 422 VALIDATION_ERROR, nothing read or written",
      async (mode) => {
        const res = await close(mode === undefined ? {} : { mode });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
      },
    );

    test("a Pending vet can't close their account here → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await close({ mode: "deactivate" });

      expect(res.status).toBe(401);
    });

    test("Staff role → 403", async () => {
      const res = await request(app)
        .delete("/api/v1/vets/me")
        .set("Authorization", `Bearer ${signToken("Staff")}`)
        .send({ mode: "deactivate" });

      expect(res.status).toBe(403);
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["get", "/api/v1/vets/me"],
      ["put", "/api/v1/vets/me"],
      ["get", "/api/v1/vets/me/government-id"],
      ["post", "/api/v1/vets/me/government-id"],
      ["patch", "/api/v1/vets/me/onboarding-step"],
      ["patch", "/api/v1/vets/me/onboarding-complete"],
    ])("%s %s: Staff role → 403 FORBIDDEN, nothing written", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(prisma.veterinarian.update).not.toHaveBeenCalled();
      expect(prisma.governmentID.create).not.toHaveBeenCalled();
    });

    test("a Pending Staff member can't reach /vets/me either → 403", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await request(app)
        .get("/api/v1/vets/me")
        .set("Authorization", `Bearer ${signToken("Staff")}`);

      expect(res.status).toBe(403);
    });
  });
});
