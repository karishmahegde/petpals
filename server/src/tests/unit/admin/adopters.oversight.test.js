const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — adopters.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  adopter: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  governmentID: { findFirst: jest.fn() },
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// authenticate.js calls the real getAccountStatus on every protected
// request; auto-mocked here (same approach as authenticate.test.js) so this
// suite doesn't need a real accountStatus-bearing table for the token's role.
// This also auto-mocks nullifyRefreshToken, which
// adopters.service.js's updateAdopterStatus calls for any non-Active
// transition — the automock resolves undefined, which is a valid
// already-resolved entry inside the service's Promise.all-backed transaction.
jest.mock("../../../services/auth/auth.service");

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 1) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = () => signToken("Admin");
const staffToken = () => signToken("Staff");

// Matches ADOPTER_LIST_SELECT in adopters.service.js — deliberately has no
// governmentID or stripeCustomerID field, ever.
const buildAdopterRow = (overrides = {}) => ({
  userID: 12,
  avatarSeed: "seed-12",
  adopterName: "Taylor Kim",
  adopterPhone: "+12125550105",
  accountStatus: "Active",
  adopterRiskFlag: false,
  preQualifyFlag: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  city: "Brooklyn",
  state: "NY",
  country: "US",
  user: { userEmail: "taylor@example.com" },
  ...overrides,
});

describe("Adopter oversight endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /adopters —————————————————————————————
  describe("GET /api/v1/adopters", () => {
    test("accountStatus filter → where clause scoped to that status, matching subset returned", async () => {
      prisma.adopter.findMany.mockResolvedValueOnce([
        buildAdopterRow({ userID: 1, accountStatus: "Banned" }),
      ]);
      prisma.adopter.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/adopters")
        .query({ accountStatus: "Banned" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.adopter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountStatus: "Banned" } }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].accountStatus).toBe("Banned");
    });

    test("adopterRiskFlag=true filter → where clause scoped to flagged adopters, matching subset returned", async () => {
      prisma.adopter.findMany.mockResolvedValueOnce([
        buildAdopterRow({ userID: 2, adopterRiskFlag: true }),
      ]);
      prisma.adopter.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/adopters")
        .query({ adopterRiskFlag: "true" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.adopter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adopterRiskFlag: true } }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].adopterRiskFlag).toBe(true);
    });

    test("Staff: name search → case-insensitive contains match (read-only list is Admin + Staff)", async () => {
      prisma.adopter.findMany.mockResolvedValueOnce([buildAdopterRow()]);
      prisma.adopter.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/adopters")
        .query({ name: " tay " })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.adopter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adopterName: { contains: "tay", mode: "insensitive" } },
        }),
      );
    });

    test("response never includes governmentID or stripeCustomerID — neither is in the select, neither is in the payload", async () => {
      prisma.adopter.findMany.mockResolvedValueOnce([buildAdopterRow()]);
      prisma.adopter.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/adopters")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);

      // The actual guarantee: these fields are never asked for from the DB
      // in the first place, so nothing downstream could leak them.
      const select = prisma.adopter.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty("governmentID");
      expect(select).not.toHaveProperty("stripeCustomerID");

      expect(res.body.data[0]).not.toHaveProperty("governmentID");
      expect(res.body.data[0]).not.toHaveProperty("stripeCustomerID");
    });
  });

  // ————————————————————————————— GET /adopters/:id —————————————————————————————
  describe("GET /api/v1/adopters/:id", () => {
    test("Staff: full profile, email flattened, breed name + ID verification status only", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(
        buildAdopterRow({
          housingType: "House",
          preferredBreed: { breedName: "Beagle" },
        }),
      );
      prisma.governmentID.findFirst.mockResolvedValueOnce({
        verificationStatus: "Verified",
      });

      const res = await request(app)
        .get("/api/v1/adopters/12")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        userID: 12,
        adopterEmail: "taylor@example.com",
        housingType: "House",
        preferredBreedName: "Beagle",
        governmentIdStatus: "Verified",
      });
      expect(res.body.data).not.toHaveProperty("user");
      expect(res.body.data).not.toHaveProperty("preferredBreed");

      const select = prisma.adopter.findUnique.mock.calls[0][0].select;
      expect(select).not.toHaveProperty("stripeCustomerID");
      expect(prisma.governmentID.findFirst.mock.calls[0][0].select).toEqual({
        verificationStatus: true,
      });
    });

    test("not found → 404", async () => {
      prisma.adopter.findUnique.mockResolvedValueOnce(null);
      prisma.governmentID.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/adopters/999")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
    });

    test("Adopter role → 403", async () => {
      const res = await request(app)
        .get("/api/v1/adopters/12")
        .set("Authorization", `Bearer ${signToken("Adopter", 12)}`);

      expect(res.status).toBe(403);
      expect(prisma.adopter.findUnique).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /adopters/:id/status —————————————————————————————
  describe("PATCH /api/v1/adopters/:id/status", () => {
    test("valid transition (Active → Banned) → 200, refresh token nulled as part of the same transaction", async () => {
      prisma.adopter.update.mockResolvedValueOnce({});
      prisma.adopter.findUnique.mockResolvedValueOnce(
        buildAdopterRow({ accountStatus: "Banned" }),
      );

      const res = await request(app)
        .patch("/api/v1/adopters/12/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Banned" });

      expect(res.status).toBe(200);
      expect(res.body.data.accountStatus).toBe("Banned");
      expect(prisma.adopter.update).toHaveBeenCalledWith({
        where: { userID: 12 },
        data: { accountStatus: "Banned" },
      });
    });

    test("invalid accountStatus enum value → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .patch("/api/v1/adopters/12/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ accountStatus: "Suspended" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.adopter.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    // Status changes stay Admin-only — Staff only reads (list + detail).
    test.each([
      ["patch", "/api/v1/adopters/12/status", { accountStatus: "Active" }],
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
        expect(prisma.adopter.findMany).not.toHaveBeenCalled();
        expect(prisma.adopter.update).not.toHaveBeenCalled();
      },
    );
  });
});
