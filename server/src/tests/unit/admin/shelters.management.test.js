const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database — shelters.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  shelter: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  staff: {
    findFirst: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  // The service always passes an array of already-invoked prisma calls
  // (each already a Promise) — Promise.all is a faithful enough stand-in for
  // the real transaction batching.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

// Mocked separately so this suite doesn't depend on the real offline zip
// database — resolveCoordsFromPostalCode is tested on its own in
// geocoding.resolveCoordsFromPostalCode.test.js.
jest.mock("../../../services/geocoding", () => ({
  resolveCoordsFromPostalCode: jest.fn(),
}));

// authenticate.js calls the real getAccountStatus on every protected
// request; auto-mocked here (same approach as authenticate.test.js) so this
// suite doesn't need a real accountStatus-bearing table for the token's role.
jest.mock("../../../services/auth/auth.service");

const prisma = require("../../../config/prisma");
const { resolveCoordsFromPostalCode } = require("../../../services/geocoding");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app"); // requiring app.js runs dotenv.config(), populating process.env.JWT_SECRET from .env

const signToken = (role, userID = 1) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const adminToken = () => signToken("Admin");
const staffToken = () => signToken("Staff");

// Matches the raw row shape selected by getShelterWithCoords's $queryRaw SQL
// in shelters.service.js.
const buildShelterRow = (overrides = {}) => ({
  shelterID: 3,
  shelterName: "PetPals Brooklyn",
  shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
  shelterPhone: "+12125550105",
  shelterEmail: "brooklyn@petpals.org",
  shelterZIP: 11201,
  shelterSize: 40,
  shelterStatus: "Open",
  managerStaffID: null,
  lat: 40.69,
  lng: -73.99,
  ...overrides,
});

describe("Admin shelter management endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— POST /shelters —————————————————————————————
  describe("POST /api/v1/shelters", () => {
    const validPayload = {
      shelterName: "PetPals Astoria",
      shelterAddress: "123 Main St, Astoria, NY 11102",
      shelterPhone: "+12125550105",
      shelterEmail: "astoria@petpals.org",
      shelterZIP: 11102,
      shelterSize: 40,
    };

    test("valid payload → 201, shelterStatus left for the schema's @default(Open), shelterLocation populated from the geocoded ZIP", async () => {
      resolveCoordsFromPostalCode.mockReturnValueOnce({ lat: 40.77, lng: -73.93 });
      prisma.shelter.create.mockResolvedValueOnce({ shelterID: 9 });
      prisma.$executeRaw.mockResolvedValueOnce(undefined);
      prisma.$queryRaw.mockResolvedValueOnce([
        buildShelterRow({
          shelterID: 9,
          shelterName: validPayload.shelterName,
          shelterAddress: validPayload.shelterAddress,
          shelterEmail: validPayload.shelterEmail,
          shelterZIP: validPayload.shelterZIP,
          shelterSize: validPayload.shelterSize,
          lat: 40.77,
          lng: -73.93,
        }),
      ]);

      const res = await request(app)
        .post("/api/v1/shelters")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.shelterStatus).toBe("Open");
      expect(res.body.data.lat).toBe(40.77);
      expect(res.body.data.lng).toBe(-73.93);

      // shelterStatus is never part of the write — CREATABLE_FIELDS doesn't
      // include it, so the DB's own default is what actually applies "Open".
      expect(prisma.shelter.create).toHaveBeenCalledTimes(1);
      expect(prisma.shelter.create.mock.calls[0][0].data).not.toHaveProperty(
        "shelterStatus",
      );

      // shelterLocation is populated by a follow-up raw UPDATE using the
      // geocoded coordinates, not by the initial create.
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const substitutions = prisma.$executeRaw.mock.calls[0].slice(1);
      expect(substitutions).toEqual([-73.93, 40.77, 9]);
    });

    test("unresolvable ZIP → 400 BAD_REQUEST, nothing written", async () => {
      resolveCoordsFromPostalCode.mockReturnValueOnce(null);

      const res = await request(app)
        .post("/api/v1/shelters")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(validPayload);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.shelter.create).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PUT /shelters/:id —————————————————————————————
  describe("PUT /api/v1/shelters/:id", () => {
    test("partial update → 200, only the provided field changes, no re-geocode when address/ZIP are untouched", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterZIP: 11201 });
      prisma.shelter.update.mockResolvedValueOnce({});
      prisma.$queryRaw.mockResolvedValueOnce([
        buildShelterRow({ shelterSize: 55 }),
      ]);

      const res = await request(app)
        .put("/api/v1/shelters/3")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ shelterSize: 55 });

      expect(res.status).toBe(200);
      expect(res.body.data.shelterSize).toBe(55);

      expect(prisma.shelter.update).toHaveBeenCalledWith({
        where: { shelterID: 3 },
        data: { shelterSize: 55 },
      });
      // shelterAddress/shelterZIP weren't in the body — no re-geocode raw
      // UPDATE should have been issued alongside the field update.
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /shelters/:id/status —————————————————————————————
  describe("PATCH /api/v1/shelters/:id/status", () => {
    test("invalid shelterStatus enum value → 400 BAD_REQUEST, nothing written", async () => {
      const res = await request(app)
        .patch("/api/v1/shelters/3/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ shelterStatus: "Archived" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.shelter.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /shelters/:id/manager —————————————————————————————
  describe("PATCH /api/v1/shelters/:id/manager", () => {
    // Corrected from the ticket's checklist: a staff member who doesn't
    // belong to this shelter is 404 NOT_FOUND (staffNotFoundAtShelter in
    // shelters.service.js), not 400 BAD_REQUEST — same as a nonexistent
    // staff ID entirely, per the service's own design note.
    test("staff member not found at this shelter → 404 NOT_FOUND, nothing written", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterID: 3 });
      prisma.staff.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/shelters/3/manager")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ managerStaffID: 77 });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "NOT_FOUND" },
      });
      expect(prisma.shelter.update).not.toHaveBeenCalled();
    });

    test("staff member at this shelter but Deactivated → 409 CONFLICT, nothing written", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterID: 3 });
      prisma.staff.findFirst.mockResolvedValueOnce({
        accountStatus: "Deactivated",
      });

      const res = await request(app)
        .patch("/api/v1/shelters/3/manager")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ managerStaffID: 77 });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "CONFLICT" },
      });
      expect(prisma.shelter.update).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ROLE ENFORCEMENT —————————————————————————————
  describe("role enforcement", () => {
    test.each([
      ["post", "/api/v1/shelters", {}],
      ["put", "/api/v1/shelters/3", { shelterSize: 10 }],
      ["patch", "/api/v1/shelters/3/status", { shelterStatus: "Open" }],
      ["patch", "/api/v1/shelters/3/manager", { managerStaffID: 1 }],
    ])(
      "%s %s: non-Admin role → 403 FORBIDDEN, nothing written",
      async (method, path, body) => {
        const res = await request(app)
          [method](path)
          .set("Authorization", `Bearer ${staffToken()}`)
          .send(body);

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          success: false,
          error: { code: "FORBIDDEN" },
        });
        expect(prisma.shelter.create).not.toHaveBeenCalled();
        expect(prisma.shelter.update).not.toHaveBeenCalled();
      },
    );
  });
});
