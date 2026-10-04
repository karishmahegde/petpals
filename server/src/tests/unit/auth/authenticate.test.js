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
  // The opt-in variant used by the few routes a Pending staff member, vet or
  // volunteer needs to onboard before approval (GET/PUT /staff/me, their government
  // ID, the onboarding endpoints, logout).
  app.get("/onboarding", authenticate.allowPending, (req, res) => {
    res.status(200).json({ success: true, data: req.user });
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

  // —————————————————— allowPending (onboarding before approval) ——————————————————
  describe("authenticate.allowPending", () => {
    const tokenFor = (role) =>
      jwt.sign({ userID: 42, role }, JWT_SECRET, { expiresIn: "1h" });

    test.each(["Staff", "Veterinarian", "Volunteer"])(
      "Pending %s → allowed through, req.user set",
      async (role) => {
        authService.getAccountStatus.mockResolvedValue("Pending");

        const res = await request(app)
          .get("/onboarding")
          .set("Authorization", `Bearer ${tokenFor(role)}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ userID: 42, role });
      },
    );

    test("Active Staff → allowed through", async () => {
      const res = await request(app)
        .get("/onboarding")
        .set("Authorization", `Bearer ${tokenFor("Staff")}`);

      expect(res.status).toBe(200);
    });

    test("Pending Admin → still 401 (Admin doesn't onboard before approval)", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await request(app)
        .get("/onboarding")
        .set("Authorization", `Bearer ${tokenFor("Admin")}`);

      expect(res.status).toBe(401);
    });

    test.each([
      ["Deactivated", "Staff"],
      ["DELETED", "Staff"],
      ["Deactivated", "Veterinarian"],
      ["DELETED", "Veterinarian"],
      ["Banned", "Volunteer"],
      ["Deactivated", "Volunteer"],
    ])("%s %s → still 401 (only Pending is let through)", async (status, role) => {
      authService.getAccountStatus.mockResolvedValue(status);

      const res = await request(app)
        .get("/onboarding")
        .set("Authorization", `Bearer ${tokenFor(role)}`);

      expect(res.status).toBe(401);
    });

    test.each(["Staff", "Veterinarian", "Volunteer"])(
      "the plain middleware still rejects the same Pending %s token",
      async (role) => {
        authService.getAccountStatus.mockResolvedValue("Pending");

        const res = await request(app)
          .get("/protected")
          .set("Authorization", `Bearer ${tokenFor(role)}`);

        expect(res.status).toBe(401);
      },
    );
  });
});
