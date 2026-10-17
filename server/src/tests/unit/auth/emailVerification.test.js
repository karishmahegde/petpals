const request = require("supertest");
const jwt = require("jsonwebtoken");

// Prisma, the email service and Stripe are mocked. Covers the two
// /auth/email-verification endpoints, the verification email sent at
// registration, emailVerified on the login/refresh payloads, and the soft
// gate on applying to adopt (the donation gate is in
// donor/donations.checkout.test.js).
jest.mock("../../../config/prisma", () => {
  const prisma = {
    users: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    adopter: { create: jest.fn(), findUnique: jest.fn() },
    accountToken: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    pet: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  // Interactive transactions run against the same mocked client.
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  return prisma;
});

jest.mock("../../../services/email", () => ({
  queueEmail: jest.fn(),
  templates: jest.requireActual("../../../services/email/templates"),
}));

jest.mock("../../../config/stripe", () => ({
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { queueEmail } = require("../../../services/email");
const stripe = require("../../../config/stripe");
const authService = require("../../../services/auth/auth.service");
const { hashToken } = require("../../../services/auth/accountTokens.service");
const app = require("../../../app");

const tokenFor = (userID, role) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

// The raw token from the link in the last queued email.
const linkToken = () => {
  const { text } = queueEmail.mock.calls.at(-1)[0];
  return new URL(text.match(/https?:\/\/\S+verify-email\S+/)[0]).searchParams.get("token");
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  authService.getAccountStatus.mockResolvedValue("Active");
  prisma.accountToken.findFirst.mockResolvedValue(null);
  prisma.accountToken.deleteMany.mockResolvedValue({ count: 0 });
  prisma.accountToken.create.mockResolvedValue({});
  prisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/v1/auth/email-verification", () => {
  const send = (token = tokenFor(7, "Adopter")) =>
    request(app).post("/api/v1/auth/email-verification").set("Authorization", `Bearer ${token}`);

  const unverifiedAdopter = {
    userID: 7,
    userEmail: "sam@example.test",
    role: "Adopter",
    emailVerified: false,
    adopter: { adopterName: "Sam", accountStatus: "Active" },
  };

  test("unverified → 200, link emailed to the account's address, only its hash stored", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(unverifiedAdopter);

    const res = await send();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Verification email sent");
    expect(queueEmail).toHaveBeenCalledTimes(1);
    const email = queueEmail.mock.calls[0][0];
    expect(email.to).toBe("sam@example.test");
    expect(email.subject).toBe("Verify your PetPals email address");
    expect(email.text).toContain("Hi Sam,");
    const token = linkToken();
    expect(prisma.accountToken.create.mock.calls[0][0].data).toMatchObject({
      userID: 7,
      purpose: "EmailVerification",
      tokenHash: hashToken(token),
    });
  });

  test("already verified → 409 already_verified, nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce({ ...unverifiedAdopter, emailVerified: true });

    const res = await send();

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reason: "already_verified" });
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("inside the resend cooldown → 429 with retryAfterSeconds, nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(unverifiedAdopter);
    prisma.accountToken.findFirst.mockResolvedValueOnce({ createdAt: new Date() });

    const res = await send();

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a Pending volunteer mid-onboarding can resend (allowPending)", async () => {
    authService.getAccountStatus.mockResolvedValue("Pending");
    prisma.users.findUnique.mockResolvedValueOnce({
      userID: 30,
      userEmail: "vol@example.test",
      role: "Volunteer",
      emailVerified: false,
      volunteer: { volunteerName: "Vee", accountStatus: "Pending" },
    });

    const res = await send(tokenFor(30, "Volunteer"));

    expect(res.status).toBe(200);
    expect(queueEmail.mock.calls[0][0].to).toBe("vol@example.test");
  });

  test("no session → 401", async () => {
    const res = await request(app).post("/api/v1/auth/email-verification");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/auth/email-verification", () => {
  const verify = (body) => request(app).patch("/api/v1/auth/email-verification").send(body);

  test("valid token → 200, emailVerified set in the same transaction the token is used", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce({
      tokenID: 3,
      userID: 7,
      purpose: "EmailVerification",
      newEmail: null,
      expiresAt: new Date(Date.now() + 60 * 1000),
      usedAt: null,
    });
    prisma.users.update.mockResolvedValueOnce({});

    const res = await verify({ token: "raw-token" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ emailVerified: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.accountToken.findUnique.mock.calls[0][0].where).toEqual({
      tokenHash: hashToken("raw-token"),
    });
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { userID: 7 },
      data: { emailVerified: true },
    });
  });

  test("a password-reset token can't verify an email → 400 token_invalid", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce({
      tokenID: 3,
      userID: 7,
      purpose: "PasswordReset",
      expiresAt: new Date(Date.now() + 60 * 1000),
      usedAt: null,
    });

    const res = await verify({ token: "raw-token" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_invalid" });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("expired token → 400 token_expired", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce({
      tokenID: 3,
      userID: 7,
      purpose: "EmailVerification",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    const res = await verify({ token: "raw-token" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_expired" });
  });

  test("no token → 400 token_invalid, nothing looked up", async () => {
    const res = await verify({});

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_invalid" });
    expect(prisma.accountToken.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/register", () => {
  const register = () =>
    request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sam", email: "sam@example.test", password: "Secret123!", role: "adopter" });

  beforeEach(() => {
    prisma.users.findUnique.mockResolvedValueOnce(null); // email not taken
    prisma.users.create.mockResolvedValueOnce({
      userID: 7,
      userEmail: "sam@example.test",
      userPassword: "hash",
      refreshToken: null,
      role: "Adopter",
      emailVerified: false,
      lastLoginAt: null,
    });
    prisma.adopter.create.mockResolvedValueOnce({});
  });

  test("sends a verification link once the account is created; response stays secret-free", async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ userID: 7, emailVerified: false });
    expect(res.body.data).not.toHaveProperty("userPassword");
    expect(res.body.data).not.toHaveProperty("refreshToken");
    expect(queueEmail).toHaveBeenCalledTimes(1);
    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "sam@example.test",
      subject: "Verify your PetPals email address",
    });
    expect(prisma.accountToken.create.mock.calls[0][0].data.tokenHash).toBe(hashToken(linkToken()));
  });

  test("issuing the link fails → registration still succeeds, error logged", async () => {
    prisma.accountToken.create.mockRejectedValueOnce(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await register();

    expect(res.status).toBe(201);
    expect(queueEmail).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toContain("couldn't issue a verification link");
    error.mockRestore();
  });
});

describe("soft gate — POST /api/v1/adoption-applications", () => {
  test("unverified adopter → 409 email_unverified before any pet lookup or Stripe call", async () => {
    prisma.users.findUnique.mockResolvedValueOnce({ emailVerified: false });

    const res = await request(app)
      .post("/api/v1/adoption-applications")
      .set("Authorization", `Bearer ${tokenFor(7, "Adopter")}`)
      .send({ petID: 1, shelterID: 1, applicationType: "Adopt" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Please verify your email address before applying to adopt");
    expect(res.body.error.details).toEqual({ reason: "email_unverified" });
    expect(prisma.pet.findUnique).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
