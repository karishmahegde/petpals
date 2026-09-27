const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — visits.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  visit: { findUnique: jest.fn() },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adopterToken = (userID = 7) => signToken("Adopter", userID);
const staffToken = (userID = 42) => signToken("Staff", userID);

const DAY = 86400000;

// Matches getVisitDetailForAdopter's select shape.
const buildVisitRow = (overrides = {}) => ({
  visitID: 1,
  adopterID: 7,
  visitTime: new Date(Date.now() + DAY),
  remarks: "Meet and greet",
  visitStatus: "Confirmed",
  pet: {
    petName: "Biscuit",
    petPhoto: "biscuit.jpg",
    breed: { breedName: "Beagle", species: { speciesName: "Dog" } },
  },
  shelter: { shelterName: "Downtown Shelter", shelterAddress: "1 Main St" },
  staff: { staffName: "Jo Park" },
  ...overrides,
});

const getVisit = (id = 1, token = adopterToken()) =>
  request(app).get(`/api/v1/visits/${id}`).set("Authorization", `Bearer ${token}`);

describe("GET /api/v1/visits/:id (Adopter)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  test("own upcoming visit → flattened detail, cancellable, photo as a public URL", async () => {
    const row = buildVisitRow();
    prisma.visit.findUnique.mockResolvedValueOnce(row);

    const res = await getVisit();

    expect(res.status).toBe(200);
    expect(prisma.visit.findUnique.mock.calls[0][0].where).toEqual({ visitID: 1 });
    expect(res.body.data).toEqual({
      visitID: 1,
      visitTime: row.visitTime.toISOString(),
      remarks: "Meet and greet",
      visitStatus: "Confirmed",
      canCancel: true,
      pet: {
        petName: "Biscuit",
        petPhoto: `${process.env.SUPABASE_URL}/storage/v1/object/public/pet-images/biscuit.jpg`,
        breedName: "Beagle",
        speciesName: "Dog",
      },
      shelterName: "Downtown Shelter",
      shelterAddress: "1 Main St",
      assignedStaffName: "Jo Park",
    });
  });

  test("a visit with no pet or staff yet → pet and assignedStaffName are null", async () => {
    prisma.visit.findUnique.mockResolvedValueOnce(buildVisitRow({ pet: null, staff: null }));

    const res = await getVisit();

    expect(res.status).toBe(200);
    expect(res.body.data.pet).toBeNull();
    expect(res.body.data.assignedStaffName).toBeNull();
  });

  test.each([
    ["past", { visitTime: new Date(Date.now() - DAY) }],
    ["Cancelled", { visitStatus: "Cancelled" }],
    ["Completed", { visitStatus: "Completed" }],
  ])("%s visit → canCancel is false", async (_label, overrides) => {
    prisma.visit.findUnique.mockResolvedValueOnce(buildVisitRow(overrides));

    const res = await getVisit();

    expect(res.status).toBe(200);
    expect(res.body.data.canCancel).toBe(false);
  });

  test("another adopter's visit → 403 FORBIDDEN", async () => {
    prisma.visit.findUnique.mockResolvedValueOnce(buildVisitRow({ adopterID: 99 }));

    const res = await getVisit();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("visit not found → 404 NOT_FOUND", async () => {
    prisma.visit.findUnique.mockResolvedValueOnce(null);

    const res = await getVisit(999);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test.each(["abc", "0", "1.5"])("id %p → 400 BAD_REQUEST, nothing queried", async (id) => {
    const res = await getVisit(id);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.visit.findUnique).not.toHaveBeenCalled();
  });

  test("Staff role → 403 FORBIDDEN (this endpoint is Adopter-only)", async () => {
    const res = await getVisit(1, staffToken());

    expect(res.status).toBe(403);
    expect(prisma.visit.findUnique).not.toHaveBeenCalled();
  });

  test("no token → 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/v1/visits/1");

    expect(res.status).toBe(401);
    expect(prisma.visit.findUnique).not.toHaveBeenCalled();
  });
});
