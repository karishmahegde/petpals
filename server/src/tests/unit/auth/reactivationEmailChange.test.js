const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Prisma and the email service are mocked. Covers self-service reactivation
// of a Closed account (POST/PATCH /auth/reactivation) and the two-step login
// email change (POST/PATCH /auth/email-change).
jest.mock("../../../config/prisma", () => {
  const roleTable = () => ({ update: jest.fn() });
  return {
    users: { findUnique: jest.fn(), update: jest.fn() },
    adopter: roleTable(),
    donor: roleTable(),
    staff: roleTable(),
    veterinarian: roleTable(),
    volunteer: roleTable(),
    admin: roleTable(),
    accountToken: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
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
const app = require("../../../app");

const PASSWORD = "Secret123!";
let passwordHash;

const RELATION = {
  Adopter: ["adopter", "adopterName"],
  Donor: ["donor", "donorName"],
  Staff: ["staff", "staffName"],
  Veterinarian: ["veterinarian", "vetName"],
  Volunteer: ["volunteer", "volunteerName"],
  Admin: ["admin", "adminName"],
};

// getUserContact's one-query shape for any role.
const contactRow = (role, accountStatus, overrides = {}) => {
  const [relation, nameField] = RELATION[role];
  return {
    userID: 7,
    userEmail: "sam@example.test",
    role,
    emailVerified: false,
    [relation]: { [nameField]: "Sam", accountStatus },
    ...overrides,
  };
};

const tokenRow = (purpose, overrides = {}) => ({
  tokenID: 3,
  userID: 7,
  purpose,
  newEmail: null,
  expiresAt: new Date(Date.now() + 60 * 1000),
  usedAt: null,
  ...overrides,
});

// The raw token from the link in a queued email.
const tokenFromEmail = (call, path) => {
  const { text } = queueEmail.mock.calls[call][0];
  return new URL(text.match(new RegExp(`https?://\\S+${path}\\S+`))[0]).searchParams.get("token");
};

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
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

describe("POST /api/v1/auth/reactivation", () => {
  const ask = (body) => request(app).post("/api/v1/auth/reactivation").send(body);
  const SAME_MESSAGE = "If that email belongs to a closed account, a reactivation link is on its way";

  test("Closed account → 200, link emailed, only its hash stored", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow("Adopter", "Closed"));

    const res = await ask({ email: "sam@example.test" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(SAME_MESSAGE);
    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "sam@example.test",
      subject: "Reactivate your PetPals account",
    });
    expect(prisma.accountToken.create.mock.calls[0][0].data).toMatchObject({
      userID: 7,
      purpose: "Reactivation",
      tokenHash: hashToken(tokenFromEmail(0, "reactivate")),
    });
  });

  test.each(["Active", "Deactivated", "Declined", "Banned", "Pending"])(
    "%s account → the same 200, nothing sent (only an owner-closed account reopens itself)",
    async (accountStatus) => {
      prisma.users.findUnique
        .mockResolvedValueOnce({ userID: 7 })
        .mockResolvedValueOnce(contactRow("Staff", accountStatus));

      const res = await ask({ email: "sam@example.test" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(SAME_MESSAGE);
      expect(queueEmail).not.toHaveBeenCalled();
      expect(prisma.accountToken.create).not.toHaveBeenCalled();
    },
  );

  test("unknown email → the same 200, nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);

    const res = await ask({ email: "nobody@example.test" });

    expect(res.status).toBe(200);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("inside the cooldown → the same 200, no second email", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow("Adopter", "Closed"));
    prisma.accountToken.findFirst.mockResolvedValueOnce({ createdAt: new Date() });

    const res = await ask({ email: "sam@example.test" });

    expect(res.status).toBe(200);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a real failure issuing the link → 500, not swallowed into the 200 (only the cooldown is)", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce({ userID: 7 })
      .mockResolvedValueOnce(contactRow("Adopter", "Closed"));
    prisma.accountToken.findFirst.mockRejectedValueOnce(new Error("connection lost"));

    const res = await ask({ email: "sam@example.test" });

    expect(res.status).toBe(500);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("no email → 422", async () => {
    const res = await ask({});
    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/v1/auth/reactivation", () => {
  const reactivate = () =>
    request(app).patch("/api/v1/auth/reactivation").send({ token: "raw" });

  test.each([
    ["Adopter", "Active"],
    ["Donor", "Active"],
    ["Staff", "Pending"],
    ["Veterinarian", "Pending"],
    ["Volunteer", "Pending"],
    ["Admin", "Pending"],
  ])("Closed %s → %s, email verified", async (role, expected) => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(tokenRow("Reactivation"));
    prisma.users.findUnique.mockResolvedValueOnce(contactRow(role, "Closed"));

    const res = await reactivate();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ role, accountStatus: expected });
    const [relation] = RELATION[role];
    const { where, data } = prisma[relation].update.mock.calls[0][0];
    expect(where).toEqual({ userID: 7 });
    expect(data.accountStatus).toBe(expected);
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { userID: 7 },
      data: { emailVerified: true },
    });
  });

  test("Admin's audit trail records the owner as the one who changed it", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(tokenRow("Reactivation"));
    prisma.users.findUnique.mockResolvedValueOnce(contactRow("Admin", "Closed"));

    await reactivate();

    expect(prisma.admin.update.mock.calls[0][0].data).toMatchObject({
      accountStatus: "Pending",
      statusChangedByID: 7,
      statusChangedAt: expect.any(Date),
    });
  });

  test("no longer Closed (changed meanwhile) → 409 not_closed, nothing written", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(tokenRow("Reactivation"));
    prisma.users.findUnique.mockResolvedValueOnce(contactRow("Adopter", "Banned"));

    const res = await reactivate();

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reason: "not_closed" });
    expect(prisma.adopter.update).not.toHaveBeenCalled();
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("expired link → 400 token_expired", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(
      tokenRow("Reactivation", { expiresAt: new Date(Date.now() - 1000) }),
    );

    const res = await reactivate();

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_expired" });
  });
});

describe("POST /api/v1/auth/email-change", () => {
  const ask = (body) =>
    request(app)
      .post("/api/v1/auth/email-change")
      .set("Authorization", `Bearer ${jwt.sign({ userID: 7, role: "Adopter" }, process.env.JWT_SECRET)}`)
      .send(body);

  const valid = { newEmail: " new@example.test ", currentPassword: PASSWORD };

  test("valid → link to the NEW address (newEmail on the token), heads-up to the old one", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active")) // contact
      .mockResolvedValueOnce({ userPassword: passwordHash }) // current password
      .mockResolvedValueOnce(null); // new address free

    const res = await ask(valid);

    expect(res.status).toBe(200);
    expect(queueEmail).toHaveBeenCalledTimes(2);
    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "new@example.test",
      subject: "Confirm your new PetPals email address",
    });
    expect(queueEmail.mock.calls[1][0]).toMatchObject({
      to: "sam@example.test",
      subject: "A request to change your PetPals email address",
    });
    expect(queueEmail.mock.calls[1][0].text).toContain("new@example.test");
    expect(prisma.accountToken.create.mock.calls[0][0].data).toMatchObject({
      userID: 7,
      purpose: "EmailChange",
      newEmail: "new@example.test",
      tokenHash: hashToken(tokenFromEmail(0, "confirm-email-change")),
    });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("wrong current password → 401 wrong_password, nothing sent", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active"))
      .mockResolvedValueOnce({ userPassword: passwordHash });

    const res = await ask({ ...valid, currentPassword: "Wrong123!" });

    expect(res.status).toBe(401);
    expect(res.body.error.details).toEqual({ reason: "wrong_password" });
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("address used by another account → 409 email_taken, nothing sent", async () => {
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active"))
      .mockResolvedValueOnce({ userPassword: passwordHash })
      .mockResolvedValueOnce({ userID: 99 });

    const res = await ask(valid);

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reason: "email_taken" });
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("the account no longer exists (deleted mid-session) → 404, nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);

    const res = await ask(valid);

    expect(res.status).toBe(404);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("same as the current address (any case) → 422", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(contactRow("Adopter", "Active"));

    const res = await ask({ newEmail: "SAM@example.test", currentPassword: PASSWORD });

    expect(res.status).toBe(422);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["not an email", "nope"],
    ["too long for the column", `${"a".repeat(40)}@example.test`],
    ["missing", undefined],
  ])("newEmail %s → 422, nothing looked up", async (_label, newEmail) => {
    const res = await ask({ newEmail, currentPassword: PASSWORD });

    expect(res.status).toBe(422);
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  test("a Pending worker can't (plain authenticate) → 401", async () => {
    authService.getAccountStatus.mockResolvedValue("Pending");

    const res = await ask(valid);

    expect(res.status).toBe(401);
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/auth/email-change", () => {
  const confirm = () =>
    request(app).patch("/api/v1/auth/email-change").send({ token: "raw" });

  test("valid → login email changed and verified, old address told", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(
      tokenRow("EmailChange", { newEmail: "new@example.test" }),
    );
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active")) // the old contact
      .mockResolvedValueOnce(null); // still free

    const res = await confirm();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userEmail: "new@example.test" });
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { userID: 7 },
      data: { userEmail: "new@example.test", emailVerified: true },
    });
    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "sam@example.test",
      subject: "Your PetPals email address was changed",
    });
  });

  test("someone registered the address since → 409 email_taken, nothing written", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(
      tokenRow("EmailChange", { newEmail: "new@example.test" }),
    );
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active"))
      .mockResolvedValueOnce({ userID: 99 });

    const res = await confirm();

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reason: "email_taken" });
    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a race on the unique index → the same 409", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(
      tokenRow("EmailChange", { newEmail: "new@example.test" }),
    );
    prisma.users.findUnique
      .mockResolvedValueOnce(contactRow("Adopter", "Active"))
      .mockResolvedValueOnce(null);
    prisma.users.update.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));

    const res = await confirm();

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reason: "email_taken" });
  });

  test("a reactivation token can't change an email → 400 token_invalid", async () => {
    prisma.accountToken.findUnique.mockResolvedValueOnce(tokenRow("Reactivation"));

    const res = await confirm();

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ reason: "token_invalid" });
  });
});
