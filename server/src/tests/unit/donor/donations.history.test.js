const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  donation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  shelter: { findMany: jest.fn() },
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

// Matches DONATION_SELECT in donor/donations.service.js.
const donationRow = (overrides = {}) => ({
  donationID: 3,
  donationCode: "DON-00003",
  donationDate: new Date("2026-09-15T10:00:00Z"),
  donationAmt: 50,
  donationDesc: "For the kittens",
  shelter: { shelterID: 9, shelterName: "Downtown Shelter" },
  ...overrides,
});

const get = (path, query = {}, token = donorToken()) =>
  request(app).get(path).query(query).set("Authorization", `Bearer ${token}`);

describe("Donor donation history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /donors/me/donations —————————————————————————————
  describe("GET /api/v1/donors/me/donations", () => {
    test("only the caller's donations, newest first, no Stripe IDs", async () => {
      prisma.donation.findMany.mockResolvedValueOnce([donationRow()]);
      prisma.donation.count.mockResolvedValueOnce(1);

      const res = await get("/api/v1/donors/me/donations");

      expect(res.status).toBe(200);
      const args = prisma.donation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ donorID: 42 });
      expect(args.orderBy).toEqual({ donationDate: "desc" });
      expect(args.select).not.toHaveProperty("stripeCheckoutSessionID");
      expect(args.select).not.toHaveProperty("stripePaymentIntentID");
      expect(res.body.data[0]).toEqual({
        donationID: 3,
        donationCode: "DON-00003",
        donationDate: "2026-09-15T10:00:00.000Z",
        donationAmt: 50,
        donationDesc: "For the kittens",
        shelter: { shelterID: 9, shelterName: "Downtown Shelter" },
      });
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    test("shelterID + dateFrom (inclusive) / dateTo (exclusive) + paging", async () => {
      prisma.donation.findMany.mockResolvedValueOnce([]);
      prisma.donation.count.mockResolvedValueOnce(30);

      const res = await get("/api/v1/donors/me/donations", {
        shelterID: 9,
        dateFrom: "2026-01-01T00:00:00.000Z",
        dateTo: "2027-01-01T00:00:00.000Z",
        page: 2,
        limit: 10,
      });

      const args = prisma.donation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        donorID: 42,
        shelterID: 9,
        donationDate: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lt: new Date("2027-01-01T00:00:00.000Z"),
        },
      });
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    test.each([
      [{ shelterID: "abc" }, "shelterID"],
      [{ dateFrom: "not-a-date" }, "dateFrom"],
      [{ dateTo: "nope" }, "dateTo"],
      [{ page: 0 }, "page"],
      [{ limit: 101 }, "limit"],
    ])("invalid %j → 400, nothing read", async (query, field) => {
      const res = await get("/api/v1/donors/me/donations", query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.donation.findMany).not.toHaveBeenCalled();
    });

    // The post-payment confirmation page's poll.
    describe("?checkoutSessionId=", () => {
      test("recorded → that donation, scoped to the caller", async () => {
        prisma.donation.findFirst.mockResolvedValueOnce(donationRow());

        const res = await get("/api/v1/donors/me/donations", { checkoutSessionId: "cs_test_1" });

        expect(res.status).toBe(200);
        expect(prisma.donation.findFirst.mock.calls[0][0].where).toEqual({
          donorID: 42,
          stripeCheckoutSessionID: "cs_test_1",
        });
        expect(res.body.data.donationID).toBe(3);
        expect(res.body.pagination).toBeUndefined();
        expect(prisma.donation.findMany).not.toHaveBeenCalled();
      });

      test("webhook not landed yet → 200 with null, not a 404", async () => {
        prisma.donation.findFirst.mockResolvedValueOnce(null);

        const res = await get("/api/v1/donors/me/donations", { checkoutSessionId: "cs_test_1" });

        expect(res.status).toBe(200);
        expect(res.body.data).toBeNull();
        expect(res.body.message).toBe("Donation not recorded yet");
      });

      test("empty checkoutSessionId → 400", async () => {
        const res = await get("/api/v1/donors/me/donations", { checkoutSessionId: "" });

        expect(res.status).toBe(400);
        expect(prisma.donation.findFirst).not.toHaveBeenCalled();
      });
    });
  });

  // ————————————————————————————— GET /donors/me/donations/:id —————————————————————————————
  describe("GET /api/v1/donors/me/donations/:id", () => {
    test("own donation → 200, scoped by donorID in the query", async () => {
      prisma.donation.findFirst.mockResolvedValueOnce(donationRow());

      const res = await get("/api/v1/donors/me/donations/3");

      expect(res.status).toBe(200);
      expect(prisma.donation.findFirst.mock.calls[0][0].where).toEqual({
        donationID: 3,
        donorID: 42,
      });
      expect(res.body.data.donationCode).toBe("DON-00003");
    });

    test("another donor's (or a missing) donation → 404", async () => {
      prisma.donation.findFirst.mockResolvedValueOnce(null);

      const res = await get("/api/v1/donors/me/donations/99");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No donation exists with ID 99");
    });

    test("non-numeric id → 400", async () => {
      const res = await get("/api/v1/donors/me/donations/abc");

      expect(res.status).toBe(400);
      expect(prisma.donation.findFirst).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— GET /donors/me/donations/stats —————————————————————————————
  describe("GET /api/v1/donors/me/donations/stats", () => {
    const yearStart = "2026-01-01T05:00:00.000Z"; // the donor's local Jan 1

    test("totals, count, this year's total and per-shelter totals (largest first)", async () => {
      prisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { donationAmt: 325 }, _count: { _all: 6 } })
        .mockResolvedValueOnce({ _sum: { donationAmt: 125 } });
      prisma.donation.groupBy.mockResolvedValueOnce([
        { shelterID: 9, _sum: { donationAmt: 75 }, _count: { _all: 2 } },
        { shelterID: 4, _sum: { donationAmt: 250 }, _count: { _all: 4 } },
      ]);
      prisma.shelter.findMany.mockResolvedValueOnce([
        { shelterID: 9, shelterName: "Downtown Shelter" },
        { shelterID: 4, shelterName: "Athens Shelter" },
      ]);

      const res = await get("/api/v1/donors/me/donations/stats", { yearStart });

      expect(res.status).toBe(200);
      expect(prisma.donation.aggregate.mock.calls[0][0].where).toEqual({ donorID: 42 });
      expect(prisma.donation.aggregate.mock.calls[1][0].where).toEqual({
        donorID: 42,
        donationDate: { gte: new Date(yearStart) },
      });
      expect(res.body.data).toEqual({
        totalAmount: 325,
        donationCount: 6,
        thisYearAmount: 125,
        byShelter: [
          { shelterID: 4, shelterName: "Athens Shelter", totalAmount: 250, donationCount: 4 },
          { shelterID: 9, shelterName: "Downtown Shelter", totalAmount: 75, donationCount: 2 },
        ],
      });
    });

    test("no donations yet → zeros and an empty list, not nulls", async () => {
      prisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { donationAmt: null }, _count: { _all: 0 } })
        .mockResolvedValueOnce({ _sum: { donationAmt: null } });
      prisma.donation.groupBy.mockResolvedValueOnce([]);

      const res = await get("/api/v1/donors/me/donations/stats", { yearStart });

      expect(res.body.data).toEqual({
        totalAmount: 0,
        donationCount: 0,
        thisYearAmount: 0,
        byShelter: [],
      });
      expect(prisma.shelter.findMany).not.toHaveBeenCalled();
    });

    test.each([
      ["missing yearStart", {}],
      ["invalid yearStart", { yearStart: "last-january" }],
    ])("%s → 400", async (_label, query) => {
      const res = await get("/api/v1/donors/me/donations/stats", query);

      expect(res.status).toBe(400);
      expect(prisma.donation.aggregate).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ACCESS —————————————————————————————
  describe("access", () => {
    test.each([
      "/api/v1/donors/me/donations",
      "/api/v1/donors/me/donations/3",
      "/api/v1/donors/me/donations/stats?yearStart=2026-01-01",
    ])("%s: Staff → 403, nothing read", async (path) => {
      const res = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${signToken("Staff", 7)}`);

      expect(res.status).toBe(403);
      expect(prisma.donation.findMany).not.toHaveBeenCalled();
      expect(prisma.donation.findFirst).not.toHaveBeenCalled();
      expect(prisma.donation.aggregate).not.toHaveBeenCalled();
    });
  });
});
