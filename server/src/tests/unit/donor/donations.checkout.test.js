const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  shelter: { findUnique: jest.fn() },
  donor: { findUnique: jest.fn(), update: jest.fn() },
  donation: { create: jest.fn() },
}));

// Never talks to Stripe — every call is asserted, not executed.
jest.mock("../../../config/stripe", () => ({
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  webhooks: jest.requireActual("stripe").webhooks,
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const stripe = require("../../../config/stripe");
const authService = require("../../../services/auth/auth.service");
const donationsService = require("../../../services/donor/donations.service");
const app = require("../../../app");

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const donorToken = () => signToken("Donor");

const openShelter = { shelterName: "Downtown Shelter", shelterStatus: "Open" };

describe("Donations — Stripe Checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
    stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/cs_1" });
  });

  // ————————————————————————————— POST /donations/checkout —————————————————————————————
  describe("POST /api/v1/donations/checkout", () => {
    const checkout = (body, token = donorToken()) =>
      request(app)
        .post("/api/v1/donations/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    test("returning donor → 201 Checkout URL; session tagged kind=donation with the amount in cents, nothing recorded yet", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce(openShelter);
      prisma.donor.findUnique.mockResolvedValueOnce({
        stripeCustomerID: "cus_existing",
        donorName: "Charlie Salazar",
        user: { userEmail: "charlie@ex.com" },
      });

      const res = await checkout({ shelterID: 9, amount: 50, donationDesc: "  For the kittens " });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({ checkoutUrl: "https://checkout.stripe.test/cs_1" });
      expect(stripe.customers.create).not.toHaveBeenCalled();
      const session = stripe.checkout.sessions.create.mock.calls[0][0];
      expect(session).toMatchObject({
        customer: "cus_existing",
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: 5000,
              product_data: { name: "Donation to Downtown Shelter" },
            },
            quantity: 1,
          },
        ],
        metadata: {
          kind: "donation",
          donorID: "42",
          shelterID: "9",
          donationDesc: "For the kittens",
        },
      });
      expect(session.success_url).toMatch(
        /\/donor\/donate\/confirmation\?session_id=\{CHECKOUT_SESSION_ID\}$/,
      );
      expect(session.cancel_url).toMatch(/\/donor\/donate$/);
      expect(prisma.donation.create).not.toHaveBeenCalled();
    });

    test("first donation → Stripe customer created and saved on the donor", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce(openShelter);
      prisma.donor.findUnique.mockResolvedValueOnce({
        stripeCustomerID: null,
        donorName: "Charlie Salazar",
        user: { userEmail: "charlie@ex.com" },
      });
      stripe.customers.create.mockResolvedValueOnce({ id: "cus_new" });

      const res = await checkout({ shelterID: 9, amount: 1 });

      expect(res.status).toBe(201);
      expect(stripe.customers.create).toHaveBeenCalledWith({
        name: "Charlie Salazar",
        email: "charlie@ex.com",
      });
      expect(prisma.donor.update).toHaveBeenCalledWith({
        where: { userID: 42 },
        data: { stripeCustomerID: "cus_new" },
      });
      expect(stripe.checkout.sessions.create.mock.calls[0][0].customer).toBe("cus_new");
      expect(stripe.checkout.sessions.create.mock.calls[0][0].metadata.donationDesc).toBe("");
    });

    test("a Full shelter still takes donations", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ ...openShelter, shelterStatus: "Full" });
      prisma.donor.findUnique.mockResolvedValueOnce({
        stripeCustomerID: "cus_existing",
        donorName: "Charlie",
        user: { userEmail: "charlie@ex.com" },
      });

      const res = await checkout({ shelterID: 9, amount: 10000 });

      expect(res.status).toBe(201);
    });

    test("a Closed shelter → 409, no Stripe calls", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ ...openShelter, shelterStatus: "Closed" });

      const res = await checkout({ shelterID: 9, amount: 25 });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Downtown Shelter is closed and isn't accepting donations");
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    test("unknown shelter → 404, no Stripe calls", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce(null);

      const res = await checkout({ shelterID: 999, amount: 25 });

      expect(res.status).toBe(404);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    test.each([
      ["missing shelterID", { amount: 25 }, "shelterID"],
      ["missing amount", { shelterID: 9 }, "amount"],
      ["amount 0", { shelterID: 9, amount: 0 }, "amount"],
      ["amount over 10000", { shelterID: 9, amount: 10001 }, "amount"],
      ["fractional amount", { shelterID: 9, amount: 12.5 }, "amount"],
      ["amount as a string", { shelterID: 9, amount: "25" }, "amount"],
      ["donationDesc over 300 chars", { shelterID: 9, amount: 25, donationDesc: "x".repeat(301) }, "donationDesc"],
    ])("%s → 400, nothing read", async (_label, body, field) => {
      const res = await checkout(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.shelter.findUnique).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    test("Adopter → 403", async () => {
      const res = await checkout({ shelterID: 9, amount: 25 }, signToken("Adopter", 7));

      expect(res.status).toBe(403);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— finalizeDonation (webhook) —————————————————————————————
  describe("finalizeDonation", () => {
    const session = (overrides = {}) => ({
      id: "cs_test_donation",
      payment_intent: "pi_123",
      amount_total: 5000,
      metadata: { kind: "donation", donorID: "42", shelterID: "9", donationDesc: "For the kittens" },
      ...overrides,
    });

    test("records the donation with what Stripe actually charged", async () => {
      prisma.donation.create.mockResolvedValueOnce({});

      await donationsService.finalizeDonation(session());

      expect(prisma.donation.create).toHaveBeenCalledWith({
        data: {
          donorID: 42,
          shelterID: 9,
          donationAmt: 50,
          donationDesc: "For the kittens",
          stripeCheckoutSessionID: "cs_test_donation",
          stripePaymentIntentID: "pi_123",
        },
      });
    });

    test("an empty message is stored as null", async () => {
      prisma.donation.create.mockResolvedValueOnce({});

      await donationsService.finalizeDonation(
        session({ metadata: { kind: "donation", donorID: "42", shelterID: "9", donationDesc: "" } }),
      );

      expect(prisma.donation.create.mock.calls[0][0].data.donationDesc).toBeNull();
    });

    test("a replayed event (session already recorded) is ignored, not an error", async () => {
      prisma.donation.create.mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
      );

      await expect(donationsService.finalizeDonation(session())).resolves.toBeUndefined();
    });

    test("any other failure propagates (the webhook answers 500 so Stripe retries)", async () => {
      prisma.donation.create.mockRejectedValueOnce(new Error("connection lost"));

      await expect(donationsService.finalizeDonation(session())).rejects.toThrow("connection lost");
    });
  });
});
