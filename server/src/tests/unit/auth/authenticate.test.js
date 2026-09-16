const express = require("express"); //to create an express app
const request = require("supertest");
const jwt = require("jsonwebtoken"); //to verify the JWT token

// authenticate.js now looks up the account's live status on every request
// (see middleware/authenticate.js) — mocked here so this stays a DB-free
// unit test; the real lookup is covered by the integration suite.
jest.mock("../../../services/auth/auth.service");
const authService = require("../../../services/auth/auth.service");

const authenticate = require("../../../middleware/authenticate");

const JWT_SECRET = "test-secret"; //to store the JWT secret

const buildApp = () => {
  const app = express(); //to create an express app
  app.get("/protected", authenticate, (req, res) => {
    res.status(200).json({ success: true, data: req.user }); //to send the user data to the client
  });
  return app;
};

describe("authenticate middleware", () => {
  let app; //to store the express app

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET; //to set the JWT secret in the environment variables
  });

  beforeEach(() => {
    app = buildApp(); //to build the express app
    authService.getAccountStatus.mockReset().mockResolvedValue("Active");
  });

  // —————————————————— NO AUTHORIZATION HEADER ——————————————————
  test("no Authorization header returns 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/protected"); //to send the request to the protected endpoint

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  // —————————————————— MALFORMED OR INVALID JWT ——————————————————
  test("malformed or invalid JWT returns 401 UNAUTHORIZED", async () => {
    const res = await request(app) //to send the request to the protected endpoint
      .get("/protected")
      .set("Authorization", "Bearer not-a-valid-token");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", details: "Invalid token" },
    });
  });

  // —————————————————— EXPIRED JWT ——————————————————
  test("expired JWT returns 401 UNAUTHORIZED", async () => {
    const expiredToken = jwt.sign(
      //to sign the JWT token
      { userID: 1, role: "Adopter" },
      JWT_SECRET,
      { expiresIn: -10 },
    );

    const res = await request(app) //to send the request to the protected endpoint
      .get("/protected")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", details: "Token expired" },
    });
  });

  // —————————————————— VALID JWT ——————————————————
  test("valid JWT sets req.user and calls next()", async () => {
    const validToken = jwt.sign(
      //to sign the JWT token
      { userID: 42, role: "Staff" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const res = await request(app) //to send the request to the protected endpoint
      .get("/protected")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userID: 42, role: "Staff" });
  });

  // —————————————————— BLOCKED ACCOUNT STATUS ——————————————————
  test.each(["Deactivated", "Banned", "Pending", "DELETED"])(
    "valid JWT but %s account status returns 401 UNAUTHORIZED",
    async (status) => {
      authService.getAccountStatus.mockResolvedValue(status);
      const validToken = jwt.sign(
        { userID: 42, role: "Staff" },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "UNAUTHORIZED" },
      });
    },
  );
});
