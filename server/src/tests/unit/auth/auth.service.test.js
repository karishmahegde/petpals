// services/auth/auth.service.js, called directly with Prisma mocked: the
// register rules the route suites don't reach (shelter checks, duplicate
// email, a staff member's Manager designation, a failed verification email),
// login's refusals, getAccountStatus, logout and refresh-token rotation.
// bcrypt is real, so password and token comparisons are genuine.
jest.mock("../../../config/prisma", () => ({
  shelter: { findUnique: jest.fn() },
  users: { findUnique: jest.fn(), update: jest.fn() },
  admin: { findUnique: jest.fn() },
  staff: { findUnique: jest.fn() },
  donor: { findUnique: jest.fn() },
  volunteer: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../../services/auth/emailVerification.service", () => ({
  sendVerificationEmail: jest.fn(),
}));
jest.mock("../../../services/notifications", () => require("../notifications/notificationsMock"));

const bcrypt = require("bcrypt");
const prisma = require("../../../config/prisma");
const { sendVerificationEmail } = require("../../../services/auth/emailVerification.service");
const authService = require("../../../services/auth/auth.service");

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ————————————————————— register —————————————————————
describe("register", () => {
  // The transaction's tx: Users row, role row, and the lookups staff sign-up makes.
  const makeTx = ({ managerStaffID = null, pendingManager = null, adminCount = 1 } = {}) => {
    const tx = {
      users: { create: jest.fn().mockResolvedValue({ userID: 21, userEmail: "a@x.test", userPassword: "hash", refreshToken: null, role: "Staff" }) },
      admin: { count: jest.fn().mockResolvedValue(adminCount), create: jest.fn() },
      shelter: { findUnique: jest.fn().mockResolvedValue({ managerStaffID }) },
      staff: { findFirst: jest.fn().mockResolvedValue(pendingManager), create: jest.fn() },
      veterinarian: { create: jest.fn() },
      volunteer: { create: jest.fn() },
      adopter: { create: jest.fn() },
      donor: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    return tx;
  };

  const signUp = (role, extra = {}) =>
    authService.register({ name: "Alex", email: "a@x.test", password: "Passw0rd!", role, ...extra });

  beforeEach(() => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.shelter.findUnique.mockResolvedValue({ shelterStatus: "Open", managerStaffID: 60 });
  });

  test.each(["staff", "vet", "volunteer"])(
    "%s joining a shelter that isn't Open → 422, nothing written",
    async (role) => {
      prisma.shelter.findUnique.mockResolvedValue({ shelterStatus: "Closed", managerStaffID: 60 });

      await expect(signUp(role, { shelterID: 3 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "shelterID must reference an open shelter",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  test("an unknown shelter → 422", async () => {
    prisma.shelter.findUnique.mockResolvedValue(null);

    await expect(signUp("volunteer", { shelterID: 99 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("a vet at a shelter with no manager yet → 422 (nobody to approve them)", async () => {
    prisma.shelter.findUnique.mockResolvedValue({ shelterStatus: "Open", managerStaffID: null });

    await expect(signUp("vet", { shelterID: 3 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "This shelter isn't onboarding veterinarians yet — it has no manager assigned",
    });
  });

  test("an email already registered → 409", async () => {
    prisma.users.findUnique.mockResolvedValue({ userID: 5 });

    await expect(signUp("adopter")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A user with this email is already registered",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("hashes the password and never returns it or the refresh token", async () => {
    const tx = makeTx();

    const user = await signUp("adopter");

    const { userPassword } = tx.users.create.mock.calls[0][0].data;
    expect(userPassword).not.toBe("Passw0rd!");
    await expect(bcrypt.compare("Passw0rd!", userPassword)).resolves.toBe(true);
    expect(user).not.toHaveProperty("userPassword");
    expect(user).not.toHaveProperty("refreshToken");
  });

  test("the first staff sign-up at a shelter with no manager registers as its Manager (Pending)", async () => {
    const tx = makeTx({ managerStaffID: null, pendingManager: null });

    await signUp("staff", { shelterID: 3 });

    expect(tx.staff.create.mock.calls[0][0].data).toMatchObject({
      shelterID: 3,
      accountStatus: "Pending",
      staffDesignation: "Manager",
    });
  });

  test.each([
    ["the shelter already has a manager", { managerStaffID: 60 }],
    ["a Manager sign-up is already awaiting approval", { managerStaffID: null, pendingManager: { userID: 70 } }],
  ])("no Manager designation when %s", async (_label, txState) => {
    const tx = makeTx(txState);

    await signUp("staff", { shelterID: 3 });

    expect(tx.staff.create.mock.calls[0][0].data).not.toHaveProperty("staffDesignation");
  });

  test("a volunteer joins their shelter Pending", async () => {
    const tx = makeTx();

    await signUp("volunteer", { shelterID: 3 });

    expect(tx.volunteer.create.mock.calls[0][0].data).toMatchObject({ shelterID: 3, accountStatus: "Pending" });
  });

  test("an adopter or donor has no approval step", async () => {
    const tx = makeTx();

    await signUp("donor");

    expect(tx.donor.create.mock.calls[0][0].data).not.toHaveProperty("accountStatus");
    expect(tx.donor.create.mock.calls[0][0].data).not.toHaveProperty("shelterID");
  });

  test("a failed verification email is logged; the account still exists", async () => {
    makeTx();
    sendVerificationEmail.mockRejectedValue(new Error("rate limited"));

    await expect(signUp("adopter")).resolves.toMatchObject({ userID: 21 });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("couldn't issue a verification link for user 21: rate limited"),
    );
  });
});

// ————————————————————— login —————————————————————
describe("login", () => {
  let hash;

  beforeAll(async () => {
    hash = await bcrypt.hash("Passw0rd!", 4);
  });

  const userRow = (role) => ({
    userID: 21,
    userEmail: "a@x.test",
    role,
    userPassword: hash,
    emailVerified: true,
  });

  test("an unknown email → 404", async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(authService.login({ email: "no@x.test", password: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No account found with this email",
    });
  });

  test("a wrong password → 401, nothing recorded", async () => {
    prisma.users.findUnique.mockResolvedValue(userRow("Donor"));

    await expect(authService.login({ email: "a@x.test", password: "wrong" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Incorrect password",
    });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("a Pending Admin can't log in yet → 401, not counted as a login", async () => {
    prisma.users.findUnique.mockResolvedValue(userRow("Admin"));
    prisma.admin.findUnique.mockResolvedValue({ adminName: "Alex", accountStatus: "Pending", avatarSeed: "s" });

    await expect(authService.login({ email: "a@x.test", password: "Passw0rd!" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "This account is pending approval and can't log in yet.",
    });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("a Pending staff member can log in to onboard; accountStatus and onboarding state come back", async () => {
    prisma.users.findUnique.mockResolvedValue(userRow("Staff"));
    prisma.staff.findUnique.mockResolvedValue({
      staffName: "Alex",
      accountStatus: "Pending",
      avatarSeed: "s",
      onboardingComplete: false,
      onboardingStep: 3,
    });

    const result = await authService.login({ email: "a@x.test", password: "Passw0rd!" });

    expect(result).toMatchObject({
      name: "Alex",
      accountStatus: "Pending",
      onboardingComplete: false,
      onboardingStep: 3,
    });
    expect(result).not.toHaveProperty("userPassword");
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { userID: 21 },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  test("an Admin's session carries no onboarding or account status fields", async () => {
    prisma.users.findUnique.mockResolvedValue(userRow("Admin"));
    prisma.admin.findUnique.mockResolvedValue({ adminName: "Alex", accountStatus: "Active", avatarSeed: "s" });

    const result = await authService.login({ email: "a@x.test", password: "Passw0rd!" });

    expect(result).not.toHaveProperty("onboardingComplete");
    expect(result).not.toHaveProperty("accountStatus");
  });
});

// ————————————————————— getAccountStatus, logout —————————————————————
describe("getAccountStatus", () => {
  test("the role row's status", async () => {
    prisma.volunteer.findUnique.mockResolvedValue({ accountStatus: "Banned" });

    await expect(authService.getAccountStatus(21, "Volunteer")).resolves.toBe("Banned");
  });

  test("a role row that no longer exists (self-deleted) → DELETED", async () => {
    prisma.donor.findUnique.mockResolvedValue(null);

    await expect(authService.getAccountStatus(21, "Donor")).resolves.toBe("DELETED");
  });

  test("an unknown role → null", async () => {
    await expect(authService.getAccountStatus(21, "Wizard")).resolves.toBeNull();
  });
});

describe("logout", () => {
  test("clears the stored refresh token", async () => {
    await authService.logout(21);

    expect(prisma.users.update).toHaveBeenCalledWith({ where: { userID: 21 }, data: { refreshToken: null } });
  });
});

// ————————————————————— refreshToken (rotation) —————————————————————
describe("refreshToken", () => {
  let storedHash;

  beforeAll(async () => {
    storedHash = await bcrypt.hash("old-token", 4);
  });

  test("a user that no longer exists → 404", async () => {
    prisma.users.findUnique.mockResolvedValue(null);

    await expect(authService.refreshToken(21, "old-token", "new-token")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("no stored token (logged out, or signed out everywhere) → 401", async () => {
    prisma.users.findUnique.mockResolvedValue({ userID: 21, role: "Donor", refreshToken: null });

    await expect(authService.refreshToken(21, "old-token", "new-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Session expired, please log in again",
    });
  });

  test("a token that doesn't match the stored one → 401, nothing replaced", async () => {
    prisma.users.findUnique.mockResolvedValue({ userID: 21, role: "Donor", refreshToken: storedHash });

    await expect(authService.refreshToken(21, "stolen-or-stale", "new-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid refresh token",
    });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  test("a matching token rotates: the new token's hash replaces the old", async () => {
    prisma.users.findUnique.mockResolvedValue({ userID: 21, role: "Donor", refreshToken: storedHash, emailVerified: true });
    prisma.donor.findUnique.mockResolvedValue({ donorName: "Alex", accountStatus: "Active", avatarSeed: "s" });

    await authService.refreshToken(21, "old-token", "new-token");

    const { refreshToken: newHash } = prisma.users.update.mock.calls[0][0].data;
    await expect(bcrypt.compare("new-token", newHash)).resolves.toBe(true);
    await expect(bcrypt.compare("old-token", newHash)).resolves.toBe(false);
  });
});
