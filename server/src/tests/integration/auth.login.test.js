const request = require("supertest"); //to make http requests to the server
const jwt = require("jsonwebtoken"); //to verify the JWT token

const app = require("../../app"); // loads dotenv, so process.env.JWT_SECRET is populated below
const prisma = require("../../config/prisma"); //to interact with the database

// Runs against the DATABASE_URL configured in server/.env — the seed user
// created for this suite is removed in afterAll so no test data accumulates.
// Users.userEmail is VARCHAR(45), so the generated address must stay short.
const uniqueEmail = () =>
  `t${Date.now()}${Math.floor(Math.random() * 1000)}@ex.com`;

describe("POST /api/v1/auth/login", () => {
  let seedUser; //to store the seed user data

  beforeAll(async () => {
    const payload = {
      //to store the payload data
      name: "Login Test User",
      email: uniqueEmail(),
      password: "Secret123!",
      role: "adopter",
    };

    const res = await request(app).post("/api/v1/auth/register").send(payload); //to send the payload data to the register endpoint

    seedUser = {
      //to store the seed user data
      userID: res.body.data.userID,
      email: payload.email,
      password: payload.password,
      role: res.body.data.role, // "Adopter"
    };
  });

  afterAll(async () => {
    await prisma.adopter.deleteMany({ where: { userID: seedUser.userID } }); //to delete the seed user data from the database
    await prisma.users.deleteMany({ where: { userID: seedUser.userID } });
    await prisma.$disconnect(); //to disconnect from the database
  });

  // —————————————————— VALID CREDENTIALS ——————————————————

  test("valid credentials returns 200 with a JWT token", async () => {
    const res = await request(app) //to send the login data to the login endpoint
      .post("/api/v1/auth/login")
      .send({ email: seedUser.email, password: seedUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        token: expect.any(String),
        user: {
          userID: seedUser.userID,
          userEmail: seedUser.email,
          role: seedUser.role,
        },
      },
    });
  });

  // —————————————————— WRONG PASSWORD ——————————————————
  test("wrong password returns 401 UNAUTHORIZED", async () => {
    const res = await request(app) //to send the login data to the login endpoint
      .post("/api/v1/auth/login")
      .send({ email: seedUser.email, password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  // —————————————————— UNREGISTERED EMAIL ——————————————————
  test("unregistered email returns 404 NOT_FOUND", async () => {
    const res = await request(app) //to send the login data to the login endpoint
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail(), password: "whatever123" });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  // —————————————————— RETURNED JWT CONTAINS THE CORRECT USERID AND ROLE IN ITS PAYLOAD ——————————————————
  test("returned JWT contains the correct userID and role in its payload", async () => {
    const res = await request(app) //to send the login data to the login endpoint
      .post("/api/v1/auth/login")
      .send({ email: seedUser.email, password: seedUser.password });

    expect(res.status).toBe(200);

    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET); //to verify the JWT token
    expect(decoded).toMatchObject({
      userID: seedUser.userID,
      role: seedUser.role,
    });
  });
});
