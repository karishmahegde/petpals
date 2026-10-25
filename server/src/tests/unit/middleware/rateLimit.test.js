const express = require("express");
const request = require("supertest");

const { rateLimiter, clientIp } = require("../../../middleware/rateLimit");
const { RATE_LIMITS } = require("../../../config/rateLimits");

// A bare app per test (a fresh limiter, so counts never carry over) with the
// limiter in front of an always-200 route.
const buildApp = (name, { user } = {}) => {
  const app = express();
  app.use(express.json());
  if (user) {
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
  }
  app.post("/limited", rateLimiter(name), (req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
};

const hit = (app, body = {}) => request(app).post("/limited").send(body);

describe("rateLimiter", () => {
  // tests/setup/noRateLimits.js switches limits off for every other suite.
  beforeEach(() => {
    delete process.env.RATE_LIMITS;
  });

  afterAll(() => {
    process.env.RATE_LIMITS = "off";
  });

  test("allows the configured number of requests, then answers 429 in the standard envelope", async () => {
    const app = buildApp("emailLinkRequest");
    const { limit } = RATE_LIMITS.emailLinkRequest;

    for (let i = 0; i < limit; i += 1) {
      const res = await hit(app);
      expect(res.status).toBe(200);
    }

    const res = await hit(app);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many attempts — please try again in /),
      error: {
        code: "TOO_MANY_REQUESTS",
        details: { reason: "rate_limited", retryAfterSeconds: expect.any(Number) },
      },
    });
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(
      RATE_LIMITS.emailLinkRequest.windowMs / 1000,
    );
    expect(res.headers["retry-after"]).toBe(String(res.body.error.details.retryAfterSeconds));
    expect(res.headers.ratelimit).toBeDefined();
  });

  test("keys login by the email tried, so one account's limit doesn't block another", async () => {
    const app = buildApp("login");
    const { limit } = RATE_LIMITS.login;

    for (let i = 0; i < limit; i += 1) {
      await hit(app, { email: "target@ex.com" });
    }
    expect((await hit(app, { email: " TARGET@ex.com " })).status).toBe(429);
    expect((await hit(app, { email: "someone.else@ex.com" })).status).toBe(200);
  });

  test("keys the AI limit by the signed-in user", async () => {
    const { limit } = RATE_LIMITS.ai;
    const first = buildApp("ai", { user: { userID: 1 } });
    for (let i = 0; i < limit; i += 1) {
      await hit(first);
    }
    expect((await hit(first)).status).toBe(429);
  });

  test("RATE_LIMITS=off skips the limiter", async () => {
    process.env.RATE_LIMITS = "off";
    const app = buildApp("emailLinkRequest");
    const { limit } = RATE_LIMITS.emailLinkRequest;

    for (let i = 0; i < limit + 2; i += 1) {
      expect((await hit(app)).status).toBe(200);
    }
  });

  test("throws on an unknown limiter name", () => {
    expect(() => rateLimiter("nope")).toThrow('Unknown rate limit "nope"');
  });

  test("counts per visitor IP from the proxy headers, not Render's rotating load balancer", async () => {
    const app = buildApp("emailLinkRequest");
    const { limit } = RATE_LIMITS.emailLinkRequest;
    const fromVisitor = () =>
      request(app)
        .post("/limited")
        .set("x-vercel-forwarded-for", "171.76.85.168")
        .set("cf-connecting-ip", "3.108.223.212");

    for (let i = 0; i < limit; i += 1) {
      await fromVisitor();
    }
    expect((await fromVisitor()).status).toBe(429);
    // Another visitor through the same Vercel address has their own count.
    const other = await request(app)
      .post("/limited")
      .set("x-vercel-forwarded-for", "203.0.113.9")
      .set("cf-connecting-ip", "3.108.223.212");
    expect(other.status).toBe(200);
  });
});

describe("clientIp", () => {
  const fakeReq = (headers, ip = "10.25.1.16") => ({
    ip,
    get: (name) => headers[name.toLowerCase()],
  });

  test("through Vercel → x-vercel-forwarded-for (first entry)", () => {
    expect(
      clientIp(
        fakeReq({
          "x-vercel-forwarded-for": "171.76.85.168, 3.108.223.212",
          "cf-connecting-ip": "3.108.223.212",
        }),
      ),
    ).toBe("171.76.85.168");
  });

  test("straight to the API → cf-connecting-ip", () => {
    expect(clientIp(fakeReq({ "cf-connecting-ip": "171.76.85.168" }))).toBe("171.76.85.168");
  });

  test("no proxy headers (local) → req.ip", () => {
    expect(clientIp(fakeReq({}, "::1"))).toBe("::1");
  });
});
