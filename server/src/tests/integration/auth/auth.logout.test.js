const request = require("supertest"); //to make http requests to the server

const app = require("../../../app"); // loads dotenv
const prisma = require("../../../config/prisma"); //to interact with the database

// Runs against the DATABASE_URL configured in server/.env — the seed user
// created for this suite is removed in afterAll so no test data accumulates.
// Users.userEmail is VARCHAR(45), so the generated address must stay short.
const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000)}@ex.com`;

const extractRefreshTokenCookie = (res) => {
  const setCookie = res.headers["set-cookie"] || [];
  const cookie = setCookie.find((c) => c.startsWith("refreshToken="));
  return cookie.split(";")[0]; // "refreshToken=<value>"
};

describe("POST /api/v1/auth/logout", () => {
  let seedUser; //to store the seed user data

  beforeAll(async () => {
    const payload = {
      //to store the payload data
      name: "Logout Test User",
      email: uniqueEmail(),
      password: "Secret123!",
      role: "adopter",
    };

    const registerRes = await request(app) //to send the payload data to the register endpoint
      .post("/api/v1/auth/register")
      .send(payload);

    seedUser = {
      //to store the seed user data
      userID: registerRes.body.data.userID,
      email: payload.email,
      password: payload.password,
    };
  });

  afterAll(async () => {
    await prisma.adopter.deleteMany({ where: { userID: seedUser.userID } }); //to delete the seed user data from the database
    await prisma.users.deleteMany({ where: { userID: seedUser.userID } });
    await prisma.$disconnect(); //to disconnect from the database
  });

  // logging in because we need to test the HTTTP Cookie-based refresh token flow
  const login = () =>
    //to send the login data to the login endpoint
    request(app)
      .post("/api/v1/auth/login")
      .send({ email: seedUser.email, password: seedUser.password });

  // —————————————————— VALID TOKEN ——————————————————
  test("valid token returns 200 and removes the stored refresh token", async () => {
    const loginRes = await login(); //to send the login data to the login endpoint
    const accessToken = loginRes.body.data.token;

    // storeRefreshToken (called during login) should have written a hash to Users.refreshToken
    const beforeLogout = await prisma.users.findUnique({
      where: { userID: seedUser.userID },
    });
    expect(beforeLogout.refreshToken).not.toBeNull();

    const res = await request(app) //to send the logout data to the logout endpoint
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    const afterLogout = await prisma.users.findUnique({
      //to find the seed user data in the database
      where: { userID: seedUser.userID },
    });
    expect(afterLogout.refreshToken).toBeNull();
  });

  // —————————————————— REFRESH TOKEN USED AFTER LOGOUT ——————————————————
  // The API has no access-token blacklist — JWTs stay cryptographically valid until
  // they naturally expire. What logout actually invalidates is the stored refresh
  // token (see previous test), so "using a token after logout" is exercised here via
  // POST /auth/refresh-token: the refresh token issued at login is rejected once
  // logout has cleared Users.refreshToken server-side.
  test("refresh token used after logout returns 401 UNAUTHORIZED", async () => {
    const loginRes = await login(); //to send the login data to the login endpoint
    const accessToken = loginRes.body.data.token;
    const refreshTokenCookie = extractRefreshTokenCookie(loginRes);

    const logoutRes = await request(app) //to send the logout data to the logout endpoint
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    const res = await request(app) //to send the refresh token data to the refresh token endpoint
      .post("/api/v1/auth/refresh-token")
      .set("Cookie", [refreshTokenCookie]);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  // —————————————————— NO TOKEN PROVIDED ——————————————————
  test("no token provided returns 401 UNAUTHORIZED", async () => {
    const res = await request(app).post("/api/v1/auth/logout"); //to send the logout data to the logout endpoint

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });
});
