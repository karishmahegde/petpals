const request = require("supertest");

// Mocked so this suite never touches a real database — shelters.service.js
// resolves this same file (server/src/config/prisma.js) via require("../config/prisma"),
// so replacing it here replaces it there too. This endpoint uses
// prisma.$queryRaw (a tagged template call), not the query-builder methods.
jest.mock("../../../config/prisma", () => ({
  $queryRaw: jest.fn(),
}));

// Mocked separately so this suite doesn't depend on the real zip database —
// resolveCoordsFromPostalCode is tested on its own in
// geocoding.resolveCoordsFromPostalCode.test.js.
jest.mock("../../../services/geocoding", () => ({
  resolveCoordsFromPostalCode: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { resolveCoordsFromPostalCode } = require("../../../services/geocoding");
const app = require("../../../app");

// Matches the raw row shape selected by the $queryRaw SQL in shelters.service.js.
const buildRow = (overrides = {}) => ({
  shelterID: 1,
  shelterName: "PetPals Brooklyn",
  shelterAddress: "456 Park Avenue, Brooklyn, NY 11201",
  shelterZIP: 11201,
  distance: 3.2,
  ...overrides,
});

// $queryRaw is invoked as a tagged template — the mock receives
// (stringsArray, ...substitutions). The service's SQL interpolates
// [lng, lat, lng, lat, radius*1000], in that order.
const queryRawSubstitutions = () => prisma.$queryRaw.mock.calls[0].slice(1);

describe("GET /api/v1/shelters/nearby", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ————————————————————————————— VALID LAT/LNG —————————————————————————————
  test("valid lat/lng/radius → correct query params, shelters returned in the DB's order", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      buildRow({ shelterID: 1, distance: 1.5 }),
      buildRow({ shelterID: 2, distance: 4.2 }),
    ]);

    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 40.7128, lng: -74.006, radius: 10 });

    expect(res.status).toBe(200);
    expect(queryRawSubstitutions()).toEqual([
      -74.006, 40.7128, -74.006, 40.7128, 10000,
    ]);
    // Sort order (ASC by distance) is enforced in the SQL itself (ORDER BY
    // distance ASC) — since $queryRaw is mocked, this only verifies the
    // response preserves whatever order the DB returned, not that the SQL
    // actually sorts correctly (that's the database's job).
    expect(res.body.data.map((s) => s.shelterID)).toEqual([1, 2]);
  });

  test("lat/lng boundary values (±90 / ±180) are accepted, not rejected", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    const res1 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 90, lng: 180 });
    expect(res1.status).toBe(200);

    prisma.$queryRaw.mockResolvedValueOnce([]);
    const res2 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: -90, lng: -180 });
    expect(res2.status).toBe(200);
  });

  test("missing lat (lng only) → 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lng: -74.006 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "BAD_REQUEST" },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("missing lng (lat only) → 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 40.7128 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("non-numeric lat/lng → 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: "abc", lng: -74.006 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("lat out of range (>90 or <-90) → 400 BAD_REQUEST", async () => {
    const res1 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 91, lng: 0 });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("BAD_REQUEST");

    const res2 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: -91, lng: 0 });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("BAD_REQUEST");

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("lng out of range (>180 or <-180) → 400 BAD_REQUEST", async () => {
    const res1 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 0, lng: 181 });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe("BAD_REQUEST");

    const res2 = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 0, lng: -181 });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe("BAD_REQUEST");

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  // ————————————————————————————— RADIUS —————————————————————————————
  describe("radius", () => {
    test("not provided → defaults to 25 (km, converted to 25000 m in the query)", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0 });

      expect(queryRawSubstitutions()[4]).toBe(25000);
    });

    test("non-numeric radius → 400 BAD_REQUEST", async () => {
      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0, radius: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    // Not part of the ticket's explicit list, but worth documenting: the
    // controller only rejects a non-numeric radius, not an out-of-range
    // one — a negative radius is passed straight through to the query.
    test("negative radius is NOT rejected — passes straight through (documents a real gap, not a recommendation)", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0, radius: -5 });

      expect(res.status).toBe(200);
      expect(queryRawSubstitutions()[4]).toBe(-5000);
    });
  });

  // ————————————————————————————— POSTAL CODE —————————————————————————————
  describe("postalCode", () => {
    test("valid postalCode → resolves via geocoding module, correct shelters returned", async () => {
      resolveCoordsFromPostalCode.mockReturnValueOnce({
        lat: 40.75,
        lng: -73.99,
      });
      prisma.$queryRaw.mockResolvedValueOnce([buildRow()]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ postalCode: "10001", radius: 10 });

      expect(resolveCoordsFromPostalCode).toHaveBeenCalledWith("10001");
      expect(res.status).toBe(200);
      expect(queryRawSubstitutions()).toEqual([
        -73.99, 40.75, -73.99, 40.75, 10000,
      ]);
      expect(res.body.data).toHaveLength(1);
    });

    test("invalid/unrecognized postalCode → 400 BAD_REQUEST with a clear message", async () => {
      resolveCoordsFromPostalCode.mockReturnValueOnce(null);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ postalCode: "00000" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        message: "No location found for that postal code",
        error: { code: "BAD_REQUEST" },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    test("postalCode takes precedence when both postalCode and lat/lng are provided", async () => {
      resolveCoordsFromPostalCode.mockReturnValueOnce({
        lat: 12.34,
        lng: -56.78,
      });
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await request(app).get("/api/v1/shelters/nearby").query({
        postalCode: "10001",
        lat: 1,
        lng: 2,
        radius: 10,
      });

      // Substitutions reflect the geocoded coords, not the raw lat/lng query params.
      expect(queryRawSubstitutions()).toEqual([
        -56.78, 12.34, -56.78, 12.34, 10000,
      ]);
    });
  });

  test("neither postalCode nor lat/lng provided → 400 BAD_REQUEST", async () => {
    const res = await request(app).get("/api/v1/shelters/nearby");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  // ————————————————————————————— RESPONSE SHAPE —————————————————————————————
  describe("response shape", () => {
    test("zero shelters within radius → returns an empty array, not an error", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test("distance is rounded to 2 decimal places and stays a number, not a string", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        buildRow({ distance: "12.34567" }),
      ]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0 });

      expect(res.body.data[0].distance).toBe(12.35);
      expect(typeof res.body.data[0].distance).toBe("number");
    });

    test("response includes shelterID, shelterName, shelterAddress, shelterZIP, and distance", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([buildRow()]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0 });

      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        [
          "shelterID",
          "shelterName",
          "shelterAddress",
          "shelterZIP",
          "distance",
        ].sort(),
      );
    });

    test("response is a plain array, not wrapped in a pagination object", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([buildRow()]);

      const res = await request(app)
        .get("/api/v1/shelters/nearby")
        .query({ lat: 0, lng: 0 });

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeUndefined();
    });
  });
});
