// Prisma fully mocked. Covers hashing (only the SHA-256 is stored), the resend
// cooldown, clearing older links, and every way a link can fail to consume.
jest.mock("../../../config/prisma", () => ({
  accountToken: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const crypto = require("crypto");
const prisma = require("../../../config/prisma");
const {
  issueToken,
  consumeToken,
  hashToken,
} = require("../../../services/auth/accountTokens.service");
const { TOKEN_TTL_MS, RESEND_COOLDOWN_MS } = require("../../../config/email");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  jest.resetAllMocks();
  prisma.accountToken.findFirst.mockResolvedValue(null);
  prisma.accountToken.deleteMany.mockResolvedValue({ count: 0 });
  prisma.accountToken.create.mockResolvedValue({});
  prisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
});

describe("issueToken", () => {
  test("stores only the hash of a random token and returns the raw one", async () => {
    const before = Date.now();
    const { token, expiresAt } = await issueToken(7, "PasswordReset");

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
    const { data } = prisma.accountToken.create.mock.calls[0][0];
    expect(data).toEqual({
      userID: 7,
      purpose: "PasswordReset",
      tokenHash: sha256(token),
      newEmail: null,
      expiresAt,
    });
    expect(data.tokenHash).not.toBe(token);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + TOKEN_TTL_MS.PasswordReset);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + TOKEN_TTL_MS.PasswordReset);
  });

  test("each call gives a different token", async () => {
    const a = await issueToken(7, "EmailVerification");
    const b = await issueToken(7, "EmailVerification");
    expect(a.token).not.toBe(b.token);
  });

  test("keeps newEmail for an email change", async () => {
    await issueToken(7, "EmailChange", { newEmail: "new@example.test" });
    expect(prisma.accountToken.create.mock.calls[0][0].data.newEmail).toBe("new@example.test");
  });

  test("deletes the user's unused tokens of that purpose and their expired ones", async () => {
    await issueToken(7, "Reactivation");

    const { where } = prisma.accountToken.deleteMany.mock.calls[0][0];
    expect(where.userID).toBe(7);
    expect(where.OR).toEqual([
      { purpose: "Reactivation", usedAt: null },
      { expiresAt: { lt: expect.any(Date) } },
    ]);
  });

  test("inside the cooldown → 429 with retryAfterSeconds, nothing created", async () => {
    prisma.accountToken.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 20 * 1000),
    });

    const err = await issueToken(7, "EmailVerification").catch((e) => e);

    expect(err.code).toBe("TOO_MANY_REQUESTS");
    expect(err.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(err.details.retryAfterSeconds).toBeLessThanOrEqual(RESEND_COOLDOWN_MS / 1000 - 19);
    expect(prisma.accountToken.create).not.toHaveBeenCalled();
    expect(prisma.accountToken.deleteMany).not.toHaveBeenCalled();
  });

  test("the cooldown is checked per user and purpose", async () => {
    await issueToken(7, "PasswordReset");
    const { where } = prisma.accountToken.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ userID: 7, purpose: "PasswordReset" });
  });

  test("unknown purpose throws", async () => {
    await expect(issueToken(7, "Nope")).rejects.toThrow("Unknown account token purpose");
  });

  test("uses the transaction client when given one", async () => {
    const tx = {
      accountToken: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    await issueToken(7, "EmailVerification", {}, tx);
    expect(tx.accountToken.create).toHaveBeenCalled();
    expect(prisma.accountToken.create).not.toHaveBeenCalled();
  });
});

describe("consumeToken", () => {
  const validRow = (overrides = {}) => ({
    tokenID: 3,
    userID: 7,
    purpose: "PasswordReset",
    newEmail: null,
    expiresAt: new Date(Date.now() + 60 * 1000),
    usedAt: null,
    ...overrides,
  });

  test("looks the token up by its hash, marks it used, returns the user", async () => {
    prisma.accountToken.findUnique.mockResolvedValue(validRow());

    await expect(consumeToken("raw-token", "PasswordReset")).resolves.toEqual({
      userID: 7,
      newEmail: null,
    });
    expect(prisma.accountToken.findUnique.mock.calls[0][0].where).toEqual({
      tokenHash: hashToken("raw-token"),
    });
    expect(prisma.accountToken.updateMany).toHaveBeenCalledWith({
      where: { tokenID: 3, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  test("returns newEmail for an email change", async () => {
    prisma.accountToken.findUnique.mockResolvedValue(
      validRow({ purpose: "EmailChange", newEmail: "new@example.test" }),
    );
    await expect(consumeToken("t", "EmailChange")).resolves.toEqual({
      userID: 7,
      newEmail: "new@example.test",
    });
  });

  test.each([
    ["missing token", undefined, null, "token_invalid"],
    ["blank token", "  ", null, "token_invalid"],
    ["unknown token", "t", null, "token_invalid"],
    ["token for another purpose", "t", { purpose: "EmailVerification" }, "token_invalid"],
    ["used token", "t", { usedAt: new Date() }, "token_used"],
    ["expired token", "t", { expiresAt: new Date(Date.now() - 1000) }, "token_expired"],
  ])("%s → 400", async (_label, raw, override, reason) => {
    prisma.accountToken.findUnique.mockResolvedValue(override ? validRow(override) : null);

    const err = await consumeToken(raw, "PasswordReset").catch((e) => e);

    expect(err.code).toBe("BAD_REQUEST");
    expect(err.details).toEqual({ reason });
    expect(prisma.accountToken.updateMany).not.toHaveBeenCalled();
  });

  test("losing a race to another request → token_used", async () => {
    prisma.accountToken.findUnique.mockResolvedValue(validRow());
    prisma.accountToken.updateMany.mockResolvedValue({ count: 0 });

    const err = await consumeToken("t", "PasswordReset").catch((e) => e);
    expect(err.details).toEqual({ reason: "token_used" });
  });
});
