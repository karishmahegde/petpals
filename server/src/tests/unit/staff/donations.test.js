const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  donation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
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

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = () => signToken("Staff", 42);
const adopterToken = () => signToken("Adopter", 7);

describe("Donations (Staff)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/donations", () => {
    test("scoped to the staff member's shelter, newest first, with filters", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.donation.findMany.mockResolvedValueOnce([
        {
          donationID: 1,
          donationCode: "DON-00001",
          donationDate: new Date("2026-09-01"),
          donationAmt: 500,
          donor: { donorName: "Charlotte Salazar" },
        },
      ]);
      prisma.donation.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .get("/api/v1/donations")
        .query({ donorName: " char ", dateFrom: "2026-09-01T00:00:00.000Z" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.donation.findMany.mock.calls[0][0];
      expect(args.where.shelterID).toBe(9);
      expect(args.where.donor).toEqual({
        donorName: { contains: "char", mode: "insensitive" },
      });
      expect(args.where.donationDate.gte).toBeInstanceOf(Date);
      expect(args.orderBy).toEqual({ donationDate: "desc" });
      expect(res.body.data[0]).toEqual({
        donationID: 1,
        donationCode: "DON-00001",
        donationDate: "2026-09-01T00:00:00.000Z",
        donationAmt: 500,
        donorName: "Charlotte Salazar",
      });
    });

    test("invalid dateFrom -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/donations")
        .query({ dateFrom: "not-a-date" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.donation.findMany).not.toHaveBeenCalled();
    });

    test("Adopter -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/donations")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/donations/stats", () => {
    test("totals, distinct donors and this month's amount", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { donationAmt: 1240 } })
        .mockResolvedValueOnce({ _sum: { donationAmt: 500 } });
      prisma.donation.findMany.mockResolvedValueOnce([{ donorID: 1 }, { donorID: 2 }]);

      const res = await request(app)
        .get("/api/v1/donations/stats")
        .query({ monthStart: "2026-09-01T00:00:00.000Z" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        totalAmount: 1240,
        totalDonors: 2,
        thisMonthAmount: 500,
      });
    });

    test("no donations -> zeros, not null", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { donationAmt: null } })
        .mockResolvedValueOnce({ _sum: { donationAmt: null } });
      prisma.donation.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/donations/stats")
        .query({ monthStart: "2026-09-01T00:00:00.000Z" })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.body.data).toEqual({ totalAmount: 0, totalDonors: 0, thisMonthAmount: 0 });
    });

    test("missing monthStart -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/donations/stats")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/donations/:id", () => {
    const donationRow = (shelterID) => ({
      donationID: 1,
      donationCode: "DON-00001",
      donationDate: new Date("2026-09-01"),
      donationAmt: 500,
      donationDesc: "For the animals",
      shelterID,
      donor: {
        donorName: "Charlotte Salazar",
        donorPhone: "+12125550107",
        user: { userEmail: "donor@petpals.com" },
      },
    });

    test("own shelter -> donation with donor contact details only", async () => {
      prisma.donation.findUnique.mockResolvedValueOnce(donationRow(9));
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .get("/api/v1/donations/1")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.donor).toEqual({
        donorName: "Charlotte Salazar",
        donorEmail: "donor@petpals.com",
        donorPhone: "+12125550107",
      });
      expect(res.body.data).not.toHaveProperty("shelterID");
      expect(JSON.stringify(res.body)).not.toContain("stripeCustomerID");
    });

    test("another shelter's donation -> 403", async () => {
      prisma.donation.findUnique.mockResolvedValueOnce(donationRow(3));
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .get("/api/v1/donations/1")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("unknown id -> 404", async () => {
      prisma.donation.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/donations/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
