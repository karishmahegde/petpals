const request = require("supertest");
const app = require("../../../app");
const prisma = require("../../../config/prisma");

// Chained register + login + GET/PUT round trips against the remote Supabase
// instance can exceed Jest's 5s default.
jest.setTimeout(20000);

// Runs against the DATABASE_URL configured in server/.env, same convention as
// adopters.updateProfile.test.js — seeds via API calls, cleans up via Prisma
// in each test (no shared fixtures needed here).
const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

const registerAndLoginAdopter = async () => {
  const payload = {
    name: "Profile Test Adopter",
    email: uniqueEmail(),
    password: "Secret123!",
    role: "adopter",
  };
  const registerRes = await request(app)
    .post("/api/v1/auth/register")
    .send(payload);
  const userID = registerRes.body.data.userID;
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

// For the wrong-role (403) case — a Staff registration only needs
// name/email/password/role (see auth.service.js register()), so no shelter
// or other fixture rows are required just to get a valid Staff token.
const registerAndLoginStaff = async () => {
  const payload = {
    name: "Profile Test Staff",
    email: uniqueEmail(),
    password: "Secret123!",
    role: "staff",
  };
  const registerRes = await request(app)
    .post("/api/v1/auth/register")
    .send(payload);
  const userID = registerRes.body.data.userID;
  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: payload.email, password: payload.password });
  return { userID, token: loginRes.body.data.token };
};

describe("GET /api/v1/adopters/me", () => {
  test("authenticated adopter -> 200 with full profile, no password/stripe fields", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .get("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userID).toBe(userID);
    expect(res.body.data.adopterName).toBe("Profile Test Adopter");
    expect(res.body.data.avatarSeed).toBeTruthy();
    expect(res.body.data.accountStatus).toBe("Active");

    // NF-10 / CLAUDE.md "Never expose": userPassword, refreshToken,
    // governmentID, stripeCustomerID.
    expect(res.body.data).not.toHaveProperty("userPassword");
    expect(res.body.data).not.toHaveProperty("adopterPassword");
    expect(res.body.data).not.toHaveProperty("refreshToken");
    expect(res.body.data).not.toHaveProperty("governmentID");
    expect(res.body.data).not.toHaveProperty("stripeCustomerID");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("unauthenticated -> 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/v1/adopters/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  test("wrong role (staff) -> 403 FORBIDDEN", async () => {
    const { userID, token } = await registerAndLoginStaff();

    const res = await request(app)
      .get("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");

    await prisma.staff.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });
});

describe("PUT /api/v1/adopters/me", () => {
  test("valid partial update -> 200 with updated profile", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterName: "Updated Name", city: "Athens", housingType: "House" });

    expect(res.status).toBe(200);
    expect(res.body.data.adopterName).toBe("Updated Name");
    expect(res.body.data.city).toBe("Athens");
    expect(res.body.data.housingType).toBe("House");

    // Untouched fields survive the partial update unchanged.
    expect(res.body.data.accountStatus).toBe("Active");

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.adopterName).toBe("Updated Name");
    expect(adopter.city).toBe("Athens");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("invalid enum value (housingType='Castle') -> 400 BAD_REQUEST", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ housingType: "Castle" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");

    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.housingType).toBeNull();

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  test("restricted fields (adopterEmail, accountStatus) are rejected with 400, not silently applied", async () => {
    const { userID, token } = await registerAndLoginAdopter();

    const res = await request(app)
      .put("/api/v1/adopters/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ adopterEmail: "hacker@ex.com", accountStatus: "Banned" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.message).toContain("adopterEmail");
    expect(res.body.message).toContain("accountStatus");

    // Rejected outright, not partially applied alongside the bad fields.
    const adopter = await prisma.adopter.findUnique({ where: { userID } });
    expect(adopter.accountStatus).toBe("Active");

    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
