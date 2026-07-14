const request = require("supertest");

const app = require("../../../app");
const prisma = require("../../../config/prisma");

// GET /shelters/nearby uses PostGIS (a `geography` column Prisma marks
// Unsupported — see CLAUDE.md's "PostGIS migration drift" note), so
// shelterLocation can't be set via prisma.shelter.create()'s normal input
// type. Same two-step pattern seed.js uses: create the row, then a
// separate $executeRaw UPDATE to set the geography column. This suite runs
// against the real DB with the real geocoding module (no mocking) — that's
// the whole point of an integration test for this endpoint.
describe("GET /api/v1/shelters/nearby (integration)", () => {
  let sortNear;
  let sortMid;
  let sortFar;
  let boundaryShelter;
  let outsideShelter;
  let postalShelter;
  let exactBoundaryKm;
  const createdShelterIDs = [];
  let emailCounter = 0;
  // shelterEmail is VARCHAR(45), so the generated address must stay short —
  // same constraint the auth integration tests work around.
  const uniqueEmail = () => {
    emailCounter += 1;
    return `t${Date.now()}${emailCounter}@ex.com`;
  };

  const createShelterAt = async (name, lat, lng) => {
    const shelter = await prisma.shelter.create({
      data: {
        shelterName: name,
        shelterAddress: "1 Test Way, Testville, NY 10001",
        shelterPhone: "555-0100",
        shelterEmail: uniqueEmail(),
        shelterZIP: 10001,
        shelterSize: 50,
        shelterStatus: "Open",
      },
    });
    createdShelterIDs.push(shelter.shelterID);
    await prisma.$executeRaw`
      UPDATE "Shelter"
      SET "shelterLocation" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE "shelterID" = ${shelter.shelterID}
    `;
    return shelter;
  };

  beforeAll(async () => {
    // ── Distance-sorted dataset ── all due north of (0,0) — the middle of
    // the Gulf of Guinea, nowhere near any real seeded shelter, so nothing
    // else can leak into this radius.
    sortNear = await createShelterAt("IntegrationNearbySortNear", 0.05, 0);
    sortMid = await createShelterAt("IntegrationNearbySortMid", 0.5, 0);
    sortFar = await createShelterAt("IntegrationNearbySortFar", 2.0, 0);

    // ── Boundary dataset ── a separate reference point, far enough from
    // (0,0) that it can't overlap the sort test's 300km search radius.
    boundaryShelter = await createShelterAt(
      "IntegrationNearbyBoundary",
      10.1,
      10,
    );
    outsideShelter = await createShelterAt(
      "IntegrationNearbyOutside",
      10.5,
      10,
    );

    // The exact distance Postgres itself computes between (10,10) and
    // boundaryShelter — using this as the search radius means the boundary
    // math lines up with what the real endpoint recomputes, rather than
    // trusting my own geodesic approximation. One subtlety: the endpoint
    // takes radius in km and internally multiplies by 1000 to get meters —
    // dividing by 1000 here and letting it re-multiply isn't guaranteed to
    // reconstruct the exact same float bit-for-bit (division/multiplication
    // aren't perfect inverses in IEEE754), so round UP by a fraction of a
    // millimeter to guarantee inclusion regardless of which way that
    // rounding noise falls — negligible relative to the ~11km distance in
    // play, so this still faithfully tests the inclusive (<=) boundary.
    const [{ distance }] = await prisma.$queryRaw`
      SELECT ST_Distance(
        (SELECT "shelterLocation" FROM "Shelter" WHERE "shelterID" = ${boundaryShelter.shelterID}),
        ST_SetSRID(ST_MakePoint(10, 10), 4326)
      ) / 1000 AS distance
    `;
    exactBoundaryKm = Math.ceil(distance * 1e6) / 1e6;

    // ── postalCode dataset ── placed at exactly what the real `zipcodes`
    // package resolves "10001" to (verified in geocoding.resolveCoordsFromPostalCode.test.js),
    // so it's guaranteed to be within any positive radius of that lookup.
    postalShelter = await createShelterAt(
      "IntegrationNearbyPostal",
      40.7484,
      -73.9967,
    );
  });

  afterAll(async () => {
    await prisma.shelter.deleteMany({
      where: { shelterID: { in: createdShelterIDs } },
    });
    await prisma.$disconnect();
  });

  test("full round trip with real shelterLocation data → correct distance-sorted results", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 0, lng: 0, radius: 300 });

    expect(res.status).toBe(200);
    const names = res.body.data.map((s) => s.shelterName);

    const nearIdx = names.indexOf("IntegrationNearbySortNear");
    const midIdx = names.indexOf("IntegrationNearbySortMid");
    const farIdx = names.indexOf("IntegrationNearbySortFar");

    expect(nearIdx).toBeGreaterThanOrEqual(0);
    expect(midIdx).toBeGreaterThan(nearIdx);
    expect(farIdx).toBeGreaterThan(midIdx);

    // Ascending, and each row's own reported distance agrees with the order.
    const distances = res.body.data.map((s) => s.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test("full round trip using postalCode → geocoding resolves, PostGIS query runs, correct results", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ postalCode: "10001", radius: 5 });

    expect(res.status).toBe(200);
    const postal = res.body.data.find(
      (s) => s.shelterName === "IntegrationNearbyPostal",
    );
    expect(postal).toBeDefined();
    expect(postal.distance).toBe(0);
  });

  test("shelter exactly at the radius boundary → included (inclusive boundary)", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 10, lng: 10, radius: exactBoundaryKm });

    const names = res.body.data.map((s) => s.shelterName);
    expect(names).toContain("IntegrationNearbyBoundary");
  });

  test("shelter just beyond the radius → excluded", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 10, lng: 10, radius: exactBoundaryKm });

    const names = res.body.data.map((s) => s.shelterName);
    expect(names).not.toContain("IntegrationNearbyOutside");
  });

  test("response shape includes shelterID, shelterName, shelterAddress, shelterZIP, and a rounded numeric distance", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: 0, lng: 0, radius: 300 });

    const shelter = res.body.data.find(
      (s) => s.shelterName === "IntegrationNearbySortNear",
    );
    expect(Object.keys(shelter).sort()).toEqual(
      [
        "shelterID",
        "shelterName",
        "shelterAddress",
        "shelterZIP",
        "distance",
      ].sort(),
    );
    expect(typeof shelter.distance).toBe("number");
    expect(shelter.distance).toBe(Math.round(shelter.distance * 100) / 100);
  });

  test("zero shelters within radius → returns an empty array, not an error", async () => {
    const res = await request(app)
      .get("/api/v1/shelters/nearby")
      .query({ lat: -45, lng: -170, radius: 1 }); // remote ocean point, far from every seeded shelter

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
