const request = require("supertest");

// Only the DB-writing step is mocked — signature verification runs for real
// against the Stripe SDK, with payloads signed by a test-only secret below.
jest.mock("../../../services/adopter/adoptionApplications.service", () => ({
  ...jest.requireActual("../../../services/adopter/adoptionApplications.service"),
  finalizeApplication: jest.fn(),
}));

const stripe = require("../../../config/stripe");
const adoptionApplicationsService = require("../../../services/adopter/adoptionApplications.service");
const app = require("../../../app");

const TEST_WEBHOOK_SECRET = "whsec_unit_test_only";

const buildEvent = (type, object) => ({
  id: "evt_test_1",
  object: "event",
  type,
  data: { object },
});

const paidSession = (overrides = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  payment_status: "paid",
  metadata: { adopterID: "7", petID: "12" },
  ...overrides,
});

const sign = (payload, secret = TEST_WEBHOOK_SECRET) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret });

const post = (payload, signature = sign(payload)) => {
  const req = request(app)
    .post("/api/v1/webhooks/stripe")
    .set("Content-Type", "application/json");
  if (signature !== null) req.set("Stripe-Signature", signature);
  return req.send(payload);
};

describe("POST /api/v1/webhooks/stripe", () => {
  let originalSecret;
  let consoleErrorSpy;

  beforeAll(() => {
    // The controller reads the secret per request, so overriding it here is
    // enough — no real Stripe secret is needed or used.
    originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // The controller logs every rejected signature / processing failure.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("valid checkout.session.completed + paid -> finalizes the application with the session, 200", async () => {
    adoptionApplicationsService.finalizeApplication.mockResolvedValueOnce(undefined);
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));

    const res = await post(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(adoptionApplicationsService.finalizeApplication).toHaveBeenCalledTimes(1);
    expect(adoptionApplicationsService.finalizeApplication).toHaveBeenCalledWith(paidSession());
  });

  test("signature is checked against the raw bytes (unusual whitespace still verifies)", async () => {
    adoptionApplicationsService.finalizeApplication.mockResolvedValueOnce(undefined);
    // If express.json() had parsed + re-serialized the body, these bytes would
    // change and the signature would no longer match.
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()), null, 4);

    const res = await post(payload);

    expect(res.status).toBe(200);
    expect(adoptionApplicationsService.finalizeApplication).toHaveBeenCalledTimes(1);
  });

  test.each(["unpaid", "no_payment_required"])(
    "checkout.session.completed but payment_status=%s -> 200, nothing created",
    async (payment_status) => {
      const payload = JSON.stringify(
        buildEvent("checkout.session.completed", paidSession({ payment_status })),
      );

      const res = await post(payload);

      expect(res.status).toBe(200);
      expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
    },
  );

  test.each([
    "checkout.session.expired",
    "checkout.session.async_payment_failed",
    "payment_intent.succeeded",
    "charge.refunded",
  ])("unhandled event type %s -> 200 (so Stripe doesn't retry), nothing created", async (type) => {
    const payload = JSON.stringify(buildEvent(type, paidSession()));

    const res = await post(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
  });

  test("missing Stripe-Signature header -> 400, nothing created", async () => {
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));

    const res = await post(payload, null);

    expect(res.status).toBe(400);
    expect(res.text).toMatch(/^Webhook Error:/);
    expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
  });

  test("signed with a different secret -> 400, nothing created", async () => {
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));

    const res = await post(payload, sign(payload, "whsec_attacker"));

    expect(res.status).toBe(400);
    expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
  });

  test("payload tampered after signing -> 400, nothing created", async () => {
    const original = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));
    const tampered = JSON.stringify(
      buildEvent(
        "checkout.session.completed",
        paidSession({ metadata: { adopterID: "7", petID: "99" } }),
      ),
    );

    const res = await post(tampered, sign(original));

    expect(res.status).toBe(400);
    expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
  });

  test("signature older than Stripe's 5-minute tolerance (replay) -> 400", async () => {
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));
    const staleSignature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 10 * 60,
    });

    const res = await post(payload, staleSignature);

    expect(res.status).toBe(400);
    expect(adoptionApplicationsService.finalizeApplication).not.toHaveBeenCalled();
  });

  test("finalizeApplication throws -> 500 so Stripe retries the event", async () => {
    adoptionApplicationsService.finalizeApplication.mockRejectedValueOnce(new Error("db down"));
    const payload = JSON.stringify(buildEvent("checkout.session.completed", paidSession()));

    const res = await post(payload);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ received: false });
  });
});
