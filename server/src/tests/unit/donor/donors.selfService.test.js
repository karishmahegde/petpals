const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  donor: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  users: { update: jest.fn(), delete: jest.fn() },
  donation: { deleteMany: jest.fn() },
  // The service passes an array of already-invoked prisma calls (each a
  // Promise) — Promise.all is a faithful enough stand-in.
  $transaction: jest.fn((operations) => Promise.all(operations)),
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
const donorToken = () => signToken("Donor");

// Matches DONOR_SELF_SELECT in donor/donors.service.js.
const buildDonorProfile = (overrides = {}) => ({
  userID: 42,
  avatarSeed: "seed-42",
  donorName: "Charlie Salazar",
  donorPhone: "+12125550107",
  donorDOB: "1980-07-21T00:00:00.000Z",
  donorSex: "F",
  createdAt: "2026-09-01T00:00:00.000Z",
  accountStatus: "Active",
  onboardingComplete: false,
  onboardingStep: 2,
  addressLine1: "",
  addressLine2: null,
  city: "",
  state: "",
  zip: "",
  country: "",
  user: { userEmail: "charlie@ex.com", emailVerified: true, lastLoginAt: null },
  ...overrides,
});

describe("Donor self-service endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /donors/me —————————————————————————————
  describe("GET /api/v1/donors/me", () => {
    test("returns the caller's own profile, email nested and login fields lifted — never stripeCustomerID", async () => {
      prisma.donor.findUnique.mockResolvedValueOnce(buildDonorProfile());

      const res = await request(app)
        .get("/api/v1/donors/me")
        .set("Authorization", `Bearer ${donorToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.donor.findUnique.mock.calls[0][0];
      expect(args.where).toEqual({ userID: 42 });
      expect(args.select).not.toHaveProperty("stripeCustomerID");
      expect(res.body.data).toMatchObject({
        donorName: "Charlie Salazar",
        onboardingStep: 2,
        emailVerified: true,
        user: { userEmail: "charlie@ex.com" },
      });
      expect(JSON.stringify(res.body)).not.toContain("stripeCustomerID");
    });

    test("no donor row → 404 NOT_FOUND", async () => {
      prisma.donor.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/donors/me")
        .set("Authorization", `Bearer ${donorToken()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ————————————————————————————— PUT /donors/me —————————————————————————————
  describe("PUT /api/v1/donors/me", () => {
    const put = (body) =>
      request(app)
        .put("/api/v1/donors/me")
        .set("Authorization", `Bearer ${donorToken()}`)
        .send(body);

    test("personal + address fields → written, DOB parsed, phone E.164, address trimmed", async () => {
      prisma.donor.update.mockResolvedValueOnce(buildDonorProfile());

      const res = await put({
        donorName: "Charlie S.",
        donorPhone: "+1 (212) 555-0107",
        donorDOB: "1980-07-21",
        donorSex: "F",
        addressLine1: " 5 Elm St ",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "United States",
      });

      expect(res.status).toBe(200);
      expect(prisma.donor.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: {
          donorName: "Charlie S.",
          donorPhone: "+12125550107",
          donorDOB: new Date("1980-07-21"),
          donorSex: "F",
          addressLine1: "5 Elm St",
          city: "New York",
          state: "NY",
          zip: "10001",
          country: "United States",
        },
        select: expect.any(Object),
      });
    });

    test("donorPhone: null clears it (nullable field)", async () => {
      prisma.donor.update.mockResolvedValueOnce(buildDonorProfile({ donorPhone: null }));

      const res = await put({ donorPhone: null });

      expect(res.status).toBe(200);
      expect(prisma.donor.update.mock.calls[0][0].data).toEqual({ donorPhone: null });
    });

    test("unparseable donorPhone → 422, nothing written", async () => {
      const res = await put({ donorPhone: "not-a-phone" });

      expect(res.status).toBe(422);
      expect(prisma.donor.update).not.toHaveBeenCalled();
    });

    test.each(["accountStatus", "stripeCustomerID"])(
      "disallowed field '%s' → 400, nothing written",
      async (field) => {
        const res = await put({ donorName: "Charlie", [field]: "whatever" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`These fields cannot be updated here: ${field}`);
        expect(prisma.donor.update).not.toHaveBeenCalled();
      },
    );

    test.each([
      ["no updatable fields", {}],
      ["invalid donorSex", { donorSex: "X" }],
      ["invalid donorDOB", { donorDOB: "not-a-date" }],
      ["donorName over 45 chars", { donorName: "x".repeat(46) }],
      ["donorName: null (non-nullable)", { donorName: null }],
    ])("%s → 400, nothing written", async (_label, body) => {
      const res = await put(body);

      expect(res.status).toBe(400);
      expect(prisma.donor.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /donors/me/onboarding-step —————————————————————————————
  describe("PATCH /api/v1/donors/me/onboarding-step", () => {
    const advance = (step) =>
      request(app)
        .patch("/api/v1/donors/me/onboarding-step")
        .set("Authorization", `Bearer ${donorToken()}`)
        .send({ step });

    test.each([
      ["advances to the next step", 2, 2, 3],
      ["never moves backward", 4, 2, 4],
      ["stops at the last step (4 — Review)", 4, 4, 4],
    ])("%s (at %i, completed %i → %i)", async (_label, current, step, expected) => {
      prisma.donor.findUnique.mockResolvedValueOnce({ onboardingStep: current });
      prisma.donor.update.mockResolvedValueOnce(buildDonorProfile({ onboardingStep: expected }));

      const res = await advance(step);

      expect(res.status).toBe(200);
      expect(prisma.donor.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userID: 42 }, data: { onboardingStep: expected } }),
      );
    });

    // The donor wizard has no Identity step — 5 is out of range.
    test.each([1, 5, "abc", undefined])("step %p → 400, nothing read or written", async (step) => {
      const res = await advance(step);

      expect(res.status).toBe(400);
      expect(prisma.donor.findUnique).not.toHaveBeenCalled();
      expect(prisma.donor.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /donors/me/onboarding-complete —————————————————————————————
  describe("PATCH /api/v1/donors/me/onboarding-complete", () => {
    const complete = () =>
      request(app)
        .patch("/api/v1/donors/me/onboarding-complete")
        .set("Authorization", `Bearer ${donorToken()}`);

    const filledIn = {
      donorPhone: "+12125550107",
      donorDOB: new Date("1980-07-21"),
      donorSex: "F",
      addressLine1: "5 Elm St",
      city: "New York",
      state: "New York",
      zip: "10001",
      country: "United States",
    };

    test("personal + address filled in (no government ID needed) → 200, complete at step 4", async () => {
      prisma.donor.findUnique.mockResolvedValueOnce(filledIn);
      prisma.donor.update.mockResolvedValueOnce(
        buildDonorProfile({ onboardingComplete: true, onboardingStep: 4 }),
      );

      const res = await complete();

      expect(res.status).toBe(200);
      expect(prisma.donor.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { onboardingComplete: true, onboardingStep: 4 } }),
      );
    });

    test("missing fields → 409 naming each one, nothing written", async () => {
      prisma.donor.findUnique.mockResolvedValueOnce({
        ...filledIn,
        donorDOB: null,
        city: "",
        country: "",
      });

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Onboarding is incomplete — missing: Date of birth, City, Country",
      );
      expect(prisma.donor.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— DELETE /donors/me —————————————————————————————
  describe("DELETE /api/v1/donors/me", () => {
    const close = (body) =>
      request(app)
        .delete("/api/v1/donors/me")
        .set("Authorization", `Bearer ${donorToken()}`)
        .send(body);

    test("mode=deactivate → 200, status Deactivated, refresh token nulled, nothing deleted", async () => {
      prisma.donor.update.mockResolvedValueOnce({});
      prisma.users.update.mockResolvedValueOnce({});

      const res = await close({ mode: "deactivate" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deactivated");
      expect(prisma.donor.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { accountStatus: "Deactivated" },
      });
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { refreshToken: null },
      });
      expect(prisma.donor.delete).not.toHaveBeenCalled();
    });

    test("mode=delete → 200, donor + users rows removed; donations are never deleted (donorID → NULL in the DB)", async () => {
      prisma.donor.delete.mockResolvedValueOnce({});
      prisma.users.delete.mockResolvedValueOnce({});

      const res = await close({ mode: "delete" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Account deleted");
      expect(prisma.donor.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(prisma.users.delete).toHaveBeenCalledWith({ where: { userID: 42 } });
      expect(prisma.donation.deleteMany).not.toHaveBeenCalled();
    });

    test.each([undefined, "archive"])("mode %p → 422, nothing written", async (mode) => {
      const res = await close(mode === undefined ? {} : { mode });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(prisma.donor.update).not.toHaveBeenCalled();
      expect(prisma.donor.delete).not.toHaveBeenCalled();
    });

    test("Adopter → 403", async () => {
      const res = await request(app)
        .delete("/api/v1/donors/me")
        .set("Authorization", `Bearer ${signToken("Adopter")}`)
        .send({ mode: "delete" });

      expect(res.status).toBe(403);
      expect(prisma.donor.delete).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ACCESS —————————————————————————————
  describe("access", () => {
    test.each([
      ["get", "/api/v1/donors/me"],
      ["put", "/api/v1/donors/me"],
      ["patch", "/api/v1/donors/me/onboarding-step"],
      ["patch", "/api/v1/donors/me/onboarding-complete"],
    ])("%s %s: Adopter → 403, nothing read or written", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${signToken("Adopter")}`)
        .send({ step: 2 });

      expect(res.status).toBe(403);
      expect(prisma.donor.findUnique).not.toHaveBeenCalled();
      expect(prisma.donor.update).not.toHaveBeenCalled();
    });

    test("a deactivated donor's still-valid token → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Deactivated");

      const res = await request(app)
        .get("/api/v1/donors/me")
        .set("Authorization", `Bearer ${donorToken()}`);

      expect(res.status).toBe(401);
    });
  });
});
