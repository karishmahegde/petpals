const express = require("express"); //to create an express app
const request = require("supertest"); //to make http requests to the server

const { authorizeRoles, ROLES } = require("../../middleware/authorizeRoles");

const buildApp = (...allowedRoles) => {
  //to build the express app
  const app = express(); //to create an express app with the allowed roles

  // Test-only stand-in for `authenticate`: injects req.user from a header
  // so authorizeRoles can be exercised in isolation.
  app.get(
    "/restricted",
    (req, res, next) => {
      const role = req.headers["x-test-role"];
      req.user = role ? { userID: 1, role } : undefined;
      next();
    },
    authorizeRoles(...allowedRoles),
    (req, res) => {
      res.status(200).json({ success: true, data: req.user });
    },
  );

  return app;
};

describe("authorizeRoles middleware", () => {
  test("req.user.role is in allowed roles calls next()", async () => {
    const app = buildApp(ROLES.ADMIN);

    const res = await request(app)
      .get("/restricted")
      .set("x-test-role", ROLES.ADMIN);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userID: 1, role: ROLES.ADMIN });
  });

  // —————————————————— REQ.USER.ROLE IS NOT IN ALLOWED ROLES ——————————————————
  test("req.user.role is NOT in allowed roles returns 403 FORBIDDEN", async () => {
    const app = buildApp(ROLES.ADMIN, ROLES.STAFF);

    const res = await request(app)
      .get("/restricted")
      .set("x-test-role", ROLES.ADOPTER);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });

  // —————————————————— MULTIPLE ROLES PERMITTED ——————————————————
  test("multiple roles permitted — each permitted role passes", async () => {
    const permittedRoles = [ROLES.ADMIN, ROLES.STAFF, ROLES.VETERINARIAN];
    const app = buildApp(...permittedRoles);

    for (const role of permittedRoles) {
      const res = await request(app)
        .get("/restricted")
        .set("x-test-role", role);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ userID: 1, role });
    }
  });
});
