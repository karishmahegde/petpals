const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Prisma and the email service are mocked. Covers forgot/reset password
// (POST/PATCH /auth/password-reset), change password (PATCH /auth/password)
// and the shared strength rules (utils/password.js).
jest.mock("../../../config/prisma", () => {
  const prisma = {
    users: { findUnique: jest.fn(), update: jest.fn() },
    accountToken: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return prisma;
});

jest.mock("../../../services/email", () => ({
  queueEmail: jest.fn(),
  templates: jest.requireActual("../../../services/email/templates"),
}));

jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { queueEmail } = require("../../../services/email");
const authService = require("../../../services/auth/auth.service");
const { hashToken } = require("../../../services/auth/accountTokens.service");
const { unmetPasswordRules } = require("../../../utils/password");
const app = require("../../../app");

const STRONG = "NewSecret1!";
const CURRENT = "OldSecret1!";
let currentHash;

const tokenFor = (userID, role = "Adopter") =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

// getUserContact's one-query shape.
const contactRow = (overrides = {}) => ({
  userID: 7,
  userEmail: "sam@example.test",
  role: "Adopter",
  emailVerified: true,
  adopter: { adopterName: "Sam", accountStatus: "Active" },
  ...overrides,
});

const validTokenRow = (overrides = {}) => ({
  tokenID: 3,
  userID: 7,
  purpose: "PasswordReset",
  newEmail: null,
  expiresAt: new Date(Date.now() + 60 * 1000),
  usedAt: null,
  ...overrides,
});

beforeAll(async () => {
  currentHash = await bcrypt.hash(CURRENT, 4);
});

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  authService.getAccountStatus.mockResolvedValue("Active");
  prisma.users.update.mockResolvedValue({});
  prisma.accountToken.findFirst.mockResolvedValue(null);
  prisma.accountToken.deleteMany.mockResolvedValue({ count: 0 });
  prisma.accountToken.create.mockResolvedValue({});
  prisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
});

describe("unmetPasswordRules", () => {
  test.each([
    ["NewSecret1!", []],
    ["short1!A", []],
    ["alllowercase1!", ["one uppercase letter"]],
    ["NoNumbers!!", ["one number"]],
    ["NoSpecial12", ["one special character"]],
    ["Ab1!", ["at least 8 characters"]],
  ])("%s → %j", (password, unmet) => {
    expect(unmetPasswordRules(password)).toEqual(unmet);
  });

  test("not a string → every rule unmet", () => {
    expect(unmetPasswordRules(undefined)).toHaveLength(5);
  });
});

describe("POST /api/v1/auth/password-reset", () => {
  const forgot = (body) => request(app).post("/api/v1/auth/password-reset").send(body);
  const SAME_MESSAGE = "If an account exists for that email, a password reset link is on its way";

  test("existing account → 200, a 1-hour link emailed, only its hash stored", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow());

    const before = Date.now();
    const res = await forgot({ email: "  sam@example.test " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(SAME_MESSAGE);
    expect(prisma.users.findUnique.mock.calls[0][0].where).toEqual({ userEmail: "sam@example.test" });
    const email = queueEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "sam@example.test", subject: "Reset your PetPals password" });
    const token = new URL(email.text.match(/https?:\/\/\S+reset-password\S+/)[0]).searchParams.get("token");
    const { data } = prisma.accountToken.create.mock.calls[0][0];
    expect(data).toMatchObject({ userID: 7, purpose: "PasswordReset", tokenHash: hashToken(token) });
    expect(data.expiresAt.getTime() - before).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  test("unknown email → the same 200, nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);

    const res = await forgot({ email: "nobody@example.test" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(SAME_MESSAGE);
    expect(queueEmail).not.toHaveBeenCalled();
    expect(prisma.accountToken.create).not.toHaveBeenCalled();
  });

  test.each(["Banned", "Declined"])("%s account → the same 200, nothing sent", async (accountStatus) => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow({ adopter: { adopterName: "Sam", accountStatus } }));

    const res = await forgot({ email: "sam@example.test" });

    expect(res.status).toBe(200);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("inside the cooldown → the same 200, no second email (no 429 to give the account away)", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow());
    prisma.accountToken.findFirst.mockResolvedValueOnce({ createdAt: new Date() });

    const res = await forgot({ email: "sam@example.test" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(SAME_MESSAGE);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a real failure issuing the link → 500, not swallowed into the 200 (only the cooldown is)", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow());
    prisma.accountToken.findFirst.mockRejectedValueOnce(new Error("connection lost"));

    const res = await forgot({ email: "sam@example.test" });

    expect(res.status).toBe(500);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("no email → 422", async () => {
    const res = await forgot({});
    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/v1/auth/password-reset", () => {
  const reset = (body) => request(app).patch("/api/v1/auth/password-reset").send(body);

  test("valid token → new hash, every session signed out, email verified, notice sent", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(validTokenRow());
    prisma.users.findUnique.mockResolvedValueOnce(contactRow());

    const res = await reset({ token: "raw", password: STRONG });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ role: "Adopter" });
    const { where, data } = prisma.users.update.mock.calls[0][0];
    expect(where).toEqual({ userID: 7 });
    expect(data.refreshToken).toBeNull();
    expect(data.emailVerified).toBe(true);
    expect(await bcrypt.compare(STRONG, data.userPassword)).toBe(true);
    expect(res.headers["set-cookie"][0]).toMatch(/^refreshToken=;/);
    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "sam@example.test",
      subject: "Your PetPals password was changed",
    });
  });

  test("weak password → 422 naming what's missing, token untouched", async () => {
    const res = await reset({ token: "raw", password: "weakpass" });

    expect(res.status).toBe(422);
    expect(res.body.error.details.unmet).toEqual([
      "one uppercase letter",
      "one number",
      "one special character",
    ]);
    expect(prisma.accountToken.findUnique).not.toHaveBeenCalled();
  });

  test("used link → 400 token_used, password unchanged, no notice", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(validTokenRow({ usedAt: new Date() }));

    const res = await reset({ token: "raw", password: STRONG });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_used" });
    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a verification token can't reset a password → 400 token_invalid", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(
      validTokenRow({ purpose: "EmailVerification" }),
    );

    const res = await reset({ token: "raw", password: STRONG });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_invalid" });
  });
});

describe("PATCH /api/v1/auth/password", () => {
  const change = (body, token = tokenFor(7)) =>
    request(app).patch("/api/v1/auth/password").set("Authorization", `Bearer ${token}`).send(body);

  test("right current password → new hash, this session re-issued, notice sent", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userPassword: currentHash })
      .mockResolvedValueOnce(contactRow());

    const res = await change({ currentPassword: CURRENT, newPassword: STRONG });

    expect(res.status).toBe(200);
    const passwordWrite = prisma.users.update.mock.calls[0][0];
    expect(passwordWrite.where).toEqual({ userID: 7 });
    expect(await bcrypt.compare(STRONG, passwordWrite.data.userPassword)).toBe(true);
    // The fresh refresh token replaces the stored one (signing any other
    // session out) and comes back as the cookie.
    const tokenWrite = prisma.users.update.mock.calls[1][0];
    expect(tokenWrite.data.refreshToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"][0]).toMatch(/^refreshToken=[^;]+;.*HttpOnly/);
    expect(queueEmail.mock.calls[0][0].subject).toBe("Your PetPals password was changed");
  });

  test("wrong current password → 401 wrong_password, nothing written", async () => {
    prisma.users.findUnique.mockResolvedValueOnce({ userPassword: currentHash });

    const res = await change({ currentPassword: "Nope1234!", newPassword: STRONG });

    expect(res.status).toBe(401);
    expect(res.body.error.details).toEqual({ reason: "wrong_password" });
    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("same as the current password → 422", async () => {
    prisma.users.findUnique.mockResolvedValueOnce({ userPassword: currentHash });

    const res = await change({ currentPassword: CURRENT, newPassword: CURRENT });

    expect(res.status).toBe(422);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("weak new password → 422 before the current one is checked", async () => {
    const res = await change({ currentPassword: CURRENT, newPassword: "short" });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/^newPassword needs/);
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  test("a Pending staff member mid-onboarding can change it (allowPending)", async () => {
    authService.getAccountStatus.mockResolvedValue("Pending");
    prisma.users.findUnique
      .mockResolvedValueOnce({ userPassword: currentHash })
      .mockResolvedValueOnce(
        contactRow({ role: "Staff", adopter: null, staff: { staffName: "Kim", accountStatus: "Pending" } }),
      );

    const res = await change({ currentPassword: CURRENT, newPassword: STRONG }, tokenFor(7, "Staff"));

    expect(res.status).toBe(200);
  });

  test("no session → 401", async () => {
    const res = await request(app)
      .patch("/api/v1/auth/password")
      .send({ currentPassword: CURRENT, newPassword: STRONG });
    expect(res.status).toBe(401);
  });
});
