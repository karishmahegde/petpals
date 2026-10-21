// Request checks on the visit endpoints (controllers/adopter/visits.controller.js):
// POST /visits (adopter books), GET /visits (staff queue filters) and the id
// on GET/PATCH /visits/:id. The visits service is faked — its behaviour is in
// adopter/visits.detail.test.js and staff/visits.review.test.js.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));
jest.mock("../../../services/adopter/visits.service", () => ({
  ...jest.requireActual("../../../services/adopter/visits.service"),
  createVisit: jest.fn(),
  listVisitsForStaff: jest.fn(),
  getVisitDetailForAdopter: jest.fn(),
  updateVisitStatus: jest.fn(),
}));

const authService = require("../../../services/auth/auth.service");
const visitsService = require("../../../services/adopter/visits.service");
const app = require("../../../app");

const auth = (role, userID = role === "Adopter" ? 7 : 42) => ({
  Authorization: `Bearer ${jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
});

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  authService.getAccountStatus.mockResolvedValue("Active");
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ————————————————————— POST /visits —————————————————————
describe("POST /api/v1/visits", () => {
  const book = (body) => request(app).post("/api/v1/visits").set(auth("Adopter")).send(body);

  test("a valid booking reaches the service with parsed values → 201", async () => {
    visitsService.createVisit.mockResolvedValue({ visitID: 5 });
    const visitTime = tomorrow();

    const res = await book({ shelterID: "3", petID: 12, visitTime, remarks: "Weekend please" });

    expect(res.status).toBe(201);
    expect(visitsService.createVisit).toHaveBeenCalledWith({
      adopterID: 7,
      shelterID: 3,
      petID: 12,
      visitTime: new Date(visitTime),
      remarks: "Weekend please",
    });
  });

  test("petID and remarks are optional (stored as null)", async () => {
    visitsService.createVisit.mockResolvedValue({ visitID: 5 });

    await book({ shelterID: 3, petID: null, visitTime: tomorrow() });

    expect(visitsService.createVisit).toHaveBeenCalledWith(
      expect.objectContaining({ petID: null, remarks: null }),
    );
  });

  test.each([
    [{ visitTime: "x" }, "shelterID is required and must be a positive integer"],
    [{ shelterID: 0 }, "shelterID is required and must be a positive integer"],
    [{ shelterID: 3, petID: "abc" }, "petID must be a positive integer or null"],
    [{ shelterID: 3 }, "visitTime is required (ISO datetime string)"],
    [{ shelterID: 3, visitTime: "   " }, "visitTime is required (ISO datetime string)"],
    [{ shelterID: 3, visitTime: "next Tuesday" }, "visitTime must be a valid ISO datetime"],
    [{ shelterID: 3, visitTime: "2020-01-01T10:00:00Z" }, "visitTime must be in the future"],
    [{ shelterID: 3, visitTime: "FUTURE", remarks: 42 }, "remarks must be a string of at most 300 characters"],
    [{ shelterID: 3, visitTime: "FUTURE", remarks: "r".repeat(301) }, "remarks must be a string of at most 300 characters"],
  ])("%j → 400", async (body, message) => {
    const resolved = { ...body };
    if (resolved.visitTime === "FUTURE") resolved.visitTime = tomorrow();

    const res = await book(resolved);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(visitsService.createVisit).not.toHaveBeenCalled();
  });

  test("a service error is passed on (404 for an unknown shelter)", async () => {
    visitsService.createVisit.mockRejectedValue(
      Object.assign(new Error("No shelter exists with ID 3"), { code: "NOT_FOUND" }),
    );

    const res = await book({ shelterID: 3, visitTime: tomorrow() });

    expect(res.status).toBe(404);
  });
});

// ————————————————————— GET /visits (staff queue) —————————————————————
describe("GET /api/v1/visits", () => {
  const list = (query, role = "Staff") =>
    request(app).get(`/api/v1/visits${query}`).set(auth(role));

  beforeEach(() => {
    visitsService.listVisitsForStaff.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  test("passes every filter through as parsed values", async () => {
    const res = await list("?upcoming=true&status=Confirmed&name=Em&page=2&limit=5");

    expect(res.status).toBe(200);
    expect(visitsService.listVisitsForStaff).toHaveBeenCalledWith(
      { role: "Staff", userID: 42 },
      {
        upcomingOnly: true,
        pastOnly: false,
        status: "Confirmed",
        name: "Em",
        shelterID: undefined,
        page: 2,
        limit: 5,
      },
    );
  });

  test("Admin may narrow to one shelter; a Staff caller's shelterID is ignored", async () => {
    await list("?shelterID=3", "Admin");
    await list("?shelterID=3", "Staff");

    expect(visitsService.listVisitsForStaff.mock.calls[0][1].shelterID).toBe(3);
    expect(visitsService.listVisitsForStaff.mock.calls[1][1].shelterID).toBeUndefined();
  });

  test.each([
    ["?upcoming=true&past=true", "upcoming and past can't both be true"],
    ["?status=Pending", "status must be one of: Unconfirmed, Confirmed, Completed, Cancelled"],
    ["?page=0", "page must be an integer >= 1"],
    ["?limit=500", "limit must be an integer between 1 and 100"],
  ])("%s → 400", async (query, message) => {
    const res = await list(query);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(visitsService.listVisitsForStaff).not.toHaveBeenCalled();
  });

  test("Admin with an invalid shelterID → 400", async () => {
    const res = await list("?shelterID=abc", "Admin");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("shelterID must be a positive integer");
  });

  test("a service error → 500", async () => {
    visitsService.listVisitsForStaff.mockRejectedValue(new Error("connection lost"));

    const res = await list("");

    expect(res.status).toBe(500);
  });
});

// ————————————————————— /visits/:id —————————————————————
describe("the visit id", () => {
  test.each([
    ["get", "/api/v1/visits/abc"],
    ["patch", "/api/v1/visits/0"],
  ])("%s %s → 400", async (method, path) => {
    const res = await request(app)[method](path).set(auth("Adopter")).send({ visitStatus: "Cancelled" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("id is required and must be a positive integer");
    expect(visitsService.getVisitDetailForAdopter).not.toHaveBeenCalled();
    expect(visitsService.updateVisitStatus).not.toHaveBeenCalled();
  });

  test("GET passes the visit and the caller through", async () => {
    visitsService.getVisitDetailForAdopter.mockResolvedValue({ visitID: 5 });

    const res = await request(app).get("/api/v1/visits/5").set(auth("Adopter"));

    expect(res.status).toBe(200);
    expect(visitsService.getVisitDetailForAdopter).toHaveBeenCalledWith(5, 7);
  });
});
