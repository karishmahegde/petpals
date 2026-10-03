const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Mocked so this suite never touches a real database. Covers what the staff
// onboarding change added to login and session restore: a Pending Staff
// member or Veterinarian CAN log in (to onboard before approval) while
// Pending accounts of other roles still can't, and Staff/Vet sessions carry
// accountStatus plus onboarding progress. The happy-path login/refresh round trip against a
// real DB is covered by the integration suite.
jest.mock("../../../config/prisma", () => ({
  users: { findUnique: jest.fn(), update: jest.fn() },
  staff: { findUnique: jest.fn() },
  veterinarian: { findUnique: jest.fn() },
  volunteer: { findUnique: jest.fn() },
  admin: { findUnique: jest.fn() },
  adopter: { findUnique: jest.fn() },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const PASSWORD = "Secret123!";
let passwordHash;

const ROLE_MODEL = {
  Staff: { model: "staff", nameField: "staffName" },
  Veterinarian: { model: "veterinarian", nameField: "vetName" },
  Volunteer: { model: "volunteer", nameField: "volunteerName" },
  Admin: { model: "admin", nameField: "adminName" },
  Adopter: { model: "adopter", nameField: "adopterName" },
};

// Credentials row + the role table row login() reads.
const mockAccount = (role, roleRow) => {
  prisma.users.findUnique.mockResolvedValueOnce({
    userID: 42,
    userEmail: "someone@petpals.com",
    role,
    userPassword: passwordHash,
  });
  const { model, nameField } = ROLE_MODEL[role];
  prisma[model].findUnique.mockResolvedValueOnce({
    [nameField]: "Sam Taylor",
    avatarSeed: "seed-42",
    ...roleRow,
  });
};

const login = () =>
  request(app)
    .post("/api/v1/auth/login")
    .send({ email: "someone@petpals.com", password: PASSWORD });

describe("Login and session restore", () => {
  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.users.update.mockResolvedValue({});
  });

  // ————————————————————— POST /auth/login —————————————————————
  describe("POST /api/v1/auth/login", () => {
    test("Pending Staff mid-onboarding → 200 with accountStatus and onboarding progress", async () => {
      mockAccount("Staff", {
        accountStatus: "Pending",
        onboardingComplete: false,
        onboardingStep: 3,
      });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.user).toMatchObject({
        userID: 42,
        role: "Staff",
        accountStatus: "Pending",
        onboardingComplete: false,
        onboardingStep: 3,
      });
      // The staff row was asked for its onboarding progress.
      expect(prisma.staff.findUnique.mock.calls[0][0].select).toMatchObject({
        onboardingComplete: true,
        onboardingStep: true,
      });
    });

    test("Active Staff → 200 with the same fields", async () => {
      mockAccount("Staff", {
        accountStatus: "Active",
        onboardingComplete: true,
        onboardingStep: 5,
      });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        accountStatus: "Active",
        onboardingComplete: true,
        onboardingStep: 5,
      });
    });

    test("Pending Veterinarian mid-onboarding → 200 with accountStatus and onboarding progress", async () => {
      mockAccount("Veterinarian", {
        accountStatus: "Pending",
        onboardingComplete: false,
        onboardingStep: 2,
      });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.user).toMatchObject({
        userID: 42,
        role: "Veterinarian",
        accountStatus: "Pending",
        onboardingComplete: false,
        onboardingStep: 2,
      });
      expect(prisma.veterinarian.findUnique.mock.calls[0][0].select).toMatchObject({
        onboardingComplete: true,
        onboardingStep: true,
      });
    });

    test.each(["Volunteer", "Admin"])(
      "Pending %s → 401, can't log in until approved",
      async (role) => {
        mockAccount(role, { accountStatus: "Pending" });

        const res = await login();

        expect(res.status).toBe(401);
        expect(res.body.message).toBe(
          "This account is pending approval and can't log in yet.",
        );
        expect(prisma.users.update).not.toHaveBeenCalled(); // no lastLoginAt, no refresh token
      },
    );

    test("Deactivated Staff → still 401", async () => {
      mockAccount("Staff", {
        accountStatus: "Deactivated",
        onboardingComplete: true,
        onboardingStep: 5,
      });

      const res = await login();

      expect(res.status).toBe(401);
    });

    test("Adopter → onboarding progress but no accountStatus", async () => {
      mockAccount("Adopter", {
        accountStatus: "Active",
        onboardingComplete: false,
        onboardingStep: 4,
      });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        onboardingComplete: false,
        onboardingStep: 4,
      });
      expect(res.body.data.user).not.toHaveProperty("accountStatus");
    });

    test("Active Veterinarian → 200 with the same fields as Staff", async () => {
      mockAccount("Veterinarian", {
        accountStatus: "Active",
        onboardingComplete: true,
        onboardingStep: 5,
      });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        accountStatus: "Active",
        onboardingComplete: true,
        onboardingStep: 5,
      });
    });

    test("Deactivated Veterinarian → still 401", async () => {
      mockAccount("Veterinarian", { accountStatus: "Deactivated" });

      const res = await login();

      expect(res.status).toBe(401);
    });

    // Only Staff and Veterinarian are in PENDING_LOGIN_ROLES — every other
    // role's Pending account is still refused, and never gets a session.
    test.each(["Volunteer", "Admin"])(
      "Pending %s → still 401, no session issued",
      async (role) => {
        mockAccount(role, { accountStatus: "Pending" });

        const res = await login();

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHORIZED");
        expect(res.body.message).toBe(
          "This account is pending approval and can't log in yet.",
        );
        expect(res.headers["set-cookie"]).toBeUndefined();
        expect(prisma.users.update).not.toHaveBeenCalled();
      },
    );

    test("Volunteer (Active) → neither onboarding fields nor accountStatus", async () => {
      mockAccount("Volunteer", { accountStatus: "Active" });

      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.data.user).not.toHaveProperty("onboardingComplete");
      expect(res.body.data.user).not.toHaveProperty("accountStatus");
    });
  });

  // ————————————————————— POST /auth/refresh-token —————————————————————
  describe("POST /api/v1/auth/refresh-token", () => {
    test("Pending Staff → 200, session carries accountStatus and onboarding progress", async () => {
      const cookieToken = jwt.sign({ userID: 42 }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      prisma.users.findUnique.mockResolvedValueOnce({
        userID: 42,
        role: "Staff",
        refreshToken: await bcrypt.hash(cookieToken, 4),
      });
      prisma.staff.findUnique.mockResolvedValueOnce({
        staffName: "Sam Taylor",
        avatarSeed: "seed-42",
        accountStatus: "Pending",
        onboardingComplete: true,
        onboardingStep: 5,
      });

      const res = await request(app)
        .post("/api/v1/auth/refresh-token")
        .set("Cookie", `refreshToken=${cookieToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        userID: 42,
        role: "Staff",
        name: "Sam Taylor",
        avatarSeed: "seed-42",
        onboardingComplete: true,
        onboardingStep: 5,
        accountStatus: "Pending",
      });
    });

    test("Pending Veterinarian → 200, session carries accountStatus and onboarding progress", async () => {
      const cookieToken = jwt.sign({ userID: 42 }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
      prisma.users.findUnique.mockResolvedValueOnce({
        userID: 42,
        role: "Veterinarian",
        refreshToken: await bcrypt.hash(cookieToken, 4),
      });
      prisma.veterinarian.findUnique.mockResolvedValueOnce({
        vetName: "Sam Patel",
        avatarSeed: "seed-42",
        accountStatus: "Pending",
        onboardingComplete: false,
        onboardingStep: 3,
      });

      const res = await request(app)
        .post("/api/v1/auth/refresh-token")
        .set("Cookie", `refreshToken=${cookieToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        userID: 42,
        role: "Veterinarian",
        name: "Sam Patel",
        avatarSeed: "seed-42",
        onboardingComplete: false,
        onboardingStep: 3,
        accountStatus: "Pending",
      });
    });
  });
});
