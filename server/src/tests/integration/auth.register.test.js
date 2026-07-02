const request = require("supertest"); //to make http requests to the server
const bcrypt = require("bcrypt");

const app = require("../../app"); //to access the express app
const prisma = require("../../config/prisma"); //to interact with the database

// Runs against the DATABASE_URL configured in server/.env — every user this
// suite creates is removed in afterEach/afterAll so no test data accumulates.
// Users.userEmail is VARCHAR(45), so the generated address must stay short.
const uniqueEmail = () =>
  //to generate a unique email address
  `t${Date.now()}${Math.floor(Math.random() * 1000)}@ex.com`;

const validPayload = () => ({
  //to store the valid payload data
  name: "Test Adopter",
  email: uniqueEmail(),
  password: "Secret123!",
  role: "adopter",
});

describe("POST /api/v1/auth/register", () => {
  const createdUserIDs = [];

  const cleanupUser = async (userID) => {
    // Adopter row FKs to Users — must be removed first to satisfy the constraint.
    await prisma.adopter.deleteMany({ where: { userID } });
    await prisma.users.deleteMany({ where: { userID } });
  };

  afterEach(async () => {
    await Promise.all(createdUserIDs.map(cleanupUser));
    createdUserIDs.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // —————————————————— VALID PAYLOAD ——————————————————
  test("valid payload returns 201 and creates the user in the DB", async () => {
    const payload = validPayload();

    const res = await request(app).post("/api/v1/auth/register").send(payload); //to send the payload data to the register endpoint

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      data: { userEmail: payload.email, role: "Adopter" },
    });

    createdUserIDs.push(res.body.data.userID);

    const dbUser = await prisma.users.findUnique({
      where: { userEmail: payload.email },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser.userID).toBe(res.body.data.userID);

    const dbAdopter = await prisma.adopter.findUnique({
      where: { userID: dbUser.userID },
    });
    expect(dbAdopter?.adopterName).toBe(payload.name);
  });

  // —————————————————— MISSING REQUIRED FIELDS ——————————————————
  test("missing required fields returns 422 VALIDATION_ERROR", async () => {
    // Controller sets err.code = "VALIDATION_ERROR" for missing fields, which
    // errorHandler.js maps to HTTP 422 (see server/src/utils/errors.js).
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "missing-fields@example.com", password: "Secret123!" }); // no name, no role

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });

    const dbUser = await prisma.users.findUnique({
      where: { userEmail: "missing-fields@example.com" },
    });
    expect(dbUser).toBeNull();
  });

  // —————————————————— DUPLICATE EMAIL ——————————————————
  test("duplicate email returns 409 CONFLICT", async () => {
    const payload = validPayload();

    const first = await request(app)
      .post("/api/v1/auth/register")
      .send(payload);
    expect(first.status).toBe(201);
    createdUserIDs.push(first.body.data.userID);

    const duplicate = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...payload, name: "Someone Else" });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });
  });

  // —————————————————— PASSWORD IS HASHED IN THE DB, NOT STORED IN PLAINTEXT ——————————————————
  test("password is hashed in the DB, not stored in plaintext", async () => {
    const payload = validPayload();

    const res = await request(app).post("/api/v1/auth/register").send(payload);
    expect(res.status).toBe(201);
    createdUserIDs.push(res.body.data.userID);

    const dbUser = await prisma.users.findUnique({
      where: { userEmail: payload.email },
    });

    expect(dbUser.userPassword).not.toBe(payload.password);
    expect(res.body.data.userPassword).toBeUndefined();

    const passwordMatches = await bcrypt.compare(
      payload.password,
      dbUser.userPassword,
    );
    expect(passwordMatches).toBe(true);
  });
});
