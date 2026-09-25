const request = require("supertest");

// Mocked so this suite never touches a real database — events.service.js
// resolves this same file (server/src/config/prisma.js) via
// require("../../config/prisma"), so replacing it here replaces it there too.
jest.mock("../../../config/prisma", () => ({
  event: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require("../../../config/prisma");
const app = require("../../../app");

// Matches events.service.js's LIST_SELECT shape.
const buildListRow = (overrides = {}) => ({
  eventID: 1,
  eventName: "Adoption Day",
  eventDate: new Date("2026-06-01"),
  eventDesc: "Come meet our adoptable pets!",
  eventCategory: "Adoption_Event",
  shelter: { shelterID: 9, shelterName: "Athens Shelter" },
  ...overrides,
});

// Matches events.service.js's DETAIL_SELECT shape.
const buildDetailRow = (overrides = {}) => ({
  eventID: 1,
  eventName: "Adoption Day",
  eventDate: new Date("2026-06-01"),
  eventDesc: "Come meet our adoptable pets!",
  eventCategory: "Adoption_Event",
  shelter: {
    shelterID: 9,
    shelterName: "Athens Shelter",
    shelterAddress: "1 Test Way",
  },
  ...overrides,
});

describe("GET /api/v1/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("upcoming=true → only events that haven't started yet", async () => {
    prisma.event.findMany.mockResolvedValueOnce([buildListRow()]);
    prisma.event.count.mockResolvedValueOnce(1);

    const res = await request(app).get("/api/v1/events?upcoming=true");

    expect(res.status).toBe(200);
    const { where } = prisma.event.findMany.mock.calls[0][0];
    expect(where.eventDate.gt).toBeInstanceOf(Date);
    expect(prisma.event.count).toHaveBeenCalledWith({ where });
  });

  test("past=true → only started events, most recent first", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    const res = await request(app).get("/api/v1/events?past=true");

    expect(res.status).toBe(200);
    const args = prisma.event.findMany.mock.calls[0][0];
    expect(args.where.eventDate.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ eventDate: "desc" });
  });

  test("upcoming=true & past=true together → 400 BAD_REQUEST", async () => {
    const res = await request(app).get("/api/v1/events?upcoming=true&past=true");

    expect(res.status).toBe(400);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  test("no filters → lists events ordered by eventDate ascending", async () => {
    prisma.event.findMany.mockResolvedValueOnce([buildListRow()]);
    prisma.event.count.mockResolvedValueOnce(1);

    const res = await request(app).get("/api/v1/events");

    expect(res.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { eventDate: "asc" } }),
    );
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].shelter.shelterName).toBe("Athens Shelter");
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  test("?shelterID= scopes the query", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    await request(app).get("/api/v1/events").query({ shelterID: 9 });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shelterID: { in: [9] } } }),
    );
  });

  test("repeated ?shelterID= matches any of them", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    await request(app).get("/api/v1/events?shelterID=1&shelterID=2");

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shelterID: { in: [1, 2] } } }),
    );
  });

  test("?name= is a case-insensitive eventName match", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    await request(app).get("/api/v1/events").query({ name: " walk " });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventName: { contains: "walk", mode: "insensitive" } },
      }),
    );
  });

  test("pagination params are forwarded", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    await request(app).get("/api/v1/events").query({ page: 2, limit: 5 });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  test("invalid page → 400 BAD_REQUEST", async () => {
    const res = await request(app).get("/api/v1/events").query({ page: "0" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  test("invalid limit → 400 BAD_REQUEST", async () => {
    const res = await request(app).get("/api/v1/events").query({ limit: "101" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  test("no auth header required", async () => {
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.event.count.mockResolvedValueOnce(0);

    const res = await request(app).get("/api/v1/events");

    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/events/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("valid existing eventID → 200, full detail including shelter name/address", async () => {
    prisma.event.findUnique.mockResolvedValueOnce(buildDetailRow());

    const res = await request(app).get("/api/v1/events/1");

    expect(res.status).toBe(200);
    expect(prisma.event.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventID: 1 } }),
    );
    expect(res.body.data).toMatchObject({
      eventID: 1,
      eventName: "Adoption Day",
      eventDesc: "Come meet our adoptable pets!",
      shelter: {
        shelterID: 9,
        shelterName: "Athens Shelter",
        shelterAddress: "1 Test Way",
      },
    });
  });

  test("non-integer id → 400 BAD_REQUEST", async () => {
    const res = await request(app).get("/api/v1/events/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  test("valid but non-existent eventID → 404 NOT_FOUND", async () => {
    prisma.event.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get("/api/v1/events/999");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(res.body.message).toMatch(/999/);
  });
});
