// GET/PATCH /notifications (controller + services/notifications/inbox.js):
// validation, the unread filter, own-only access (another user's
// notification is a 404), marking read/unread and all read, and the pushes
// that keep a user's other tabs in step. Prisma and the hub are mocked.
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../../config/prisma", () => ({
  notification: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));
jest.mock("../../../services/notifications/hub", () => ({
  ...jest.requireActual("../../../services/notifications/hub"),
  publish: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const hub = require("../../../services/notifications/hub");
const { READ_RETENTION_MS } = require("../../../config/notifications");
const app = require("../../../app");

const USER_ID = 7;
const token = (role = "Adopter", userID = USER_ID) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const row = (overrides = {}) => ({
  notificationID: 1,
  userID: USER_ID,
  type: "ApplicationApproved",
  title: "Application approved",
  body: "Downtown approved your application for Rocky.",
  link: "/adopter/applications",
  readAt: null,
  createdAt: new Date("2026-10-20T09:00:00Z"),
  ...overrides,
});

const get = (path, role) =>
  request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token(role)}`);
const patch = (path, body) =>
  request(app).patch(`/api/v1${path}`).set("Authorization", `Bearer ${token()}`).send(body);

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((operations) => Promise.all(operations));
  authService.getAccountStatus.mockResolvedValue("Active");
  prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
});

describe("GET /api/v1/notifications", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });

  test.each(["Adopter", "Staff", "Veterinarian", "Volunteer", "Donor", "Admin"])(
    "open to every role (%s)",
    async (role) => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const res = await get("/notifications", role);

      expect(res.status).toBe(200);
    },
  );

  test("the caller's own notifications, newest first, without userID, plus the unread total", async () => {
    prisma.notification.findMany.mockResolvedValue([
      row({ notificationID: 2 }),
      row({ notificationID: 1, readAt: new Date("2026-10-20T10:00:00Z") }),
    ]);
    prisma.notification.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const res = await get("/notifications");

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userID: USER_ID },
      orderBy: [{ createdAt: "desc" }, { notificationID: "desc" }],
      skip: 0,
      take: 20,
    });
    expect(res.body.data.map((n) => n.notificationID)).toEqual([2, 1]);
    expect(res.body.data[0]).not.toHaveProperty("userID");
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(res.body.unreadCount).toBe(1);
  });

  test("unread=true lists unread only; unreadCount is still the user's total", async () => {
    prisma.notification.findMany.mockResolvedValue([row()]);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const res = await get("/notifications?unread=true");

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({
      userID: USER_ID,
      readAt: null,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userID: USER_ID, readAt: null },
    });
  });

  test("unread=false lists everything", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await get("/notifications?unread=false");

    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userID: USER_ID });
  });

  test("page and limit page through the list", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValueOnce(45).mockResolvedValueOnce(3);

    const res = await get("/notifications?page=3&limit=10");

    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 10 });
    expect(res.body.pagination).toEqual({ page: 3, limit: 10, total: 45, totalPages: 5 });
  });

  test("first deletes the caller's read notifications past the retention window", async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    const before = Date.now();

    await get("/notifications");

    const { where } = prisma.notification.deleteMany.mock.calls[0][0];
    expect(where.userID).toBe(USER_ID);
    const cutoff = where.readAt.lt.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - READ_RETENTION_MS);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - READ_RETENTION_MS);
  });

  test.each([
    ["unread=yes", "unread must be 'true' or 'false'"],
    ["page=0", "page must be an integer >= 1"],
    ["page=1.5", "page must be an integer >= 1"],
    ["limit=0", "limit must be an integer between 1 and 50"],
    ["limit=51", "limit must be an integer between 1 and 50"],
    ["limit=abc", "limit must be an integer between 1 and 50"],
  ])("400 for %s", async (query, message) => {
    const res = await get(`/notifications?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/notifications/unread-count", () => {
  test("the caller's unread total", async () => {
    prisma.notification.count.mockResolvedValue(4);

    const res = await get("/notifications/unread-count");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 4 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userID: USER_ID, readAt: null },
    });
  });
});

describe("PATCH /api/v1/notifications/:id", () => {
  test("marks an unread notification read, returns it with the new count and pushes the count", async () => {
    prisma.notification.findFirst.mockResolvedValue({ readAt: null });
    prisma.notification.update.mockImplementation(async ({ data }) => row(data));
    prisma.notification.count.mockResolvedValue(2);

    const res = await patch("/notifications/1", { read: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notification marked read");
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { notificationID: 1, userID: USER_ID },
      select: { readAt: true },
    });
    const { readAt } = prisma.notification.update.mock.calls[0][0].data;
    expect(readAt).toBeInstanceOf(Date);
    expect(res.body.data.notification).not.toHaveProperty("userID");
    expect(res.body.data.unreadCount).toBe(2);
    expect(hub.publish).toHaveBeenCalledWith(USER_ID, "unread-count", { unreadCount: 2 });
  });

  test("marking an already-read notification read keeps its first readAt", async () => {
    const firstRead = new Date("2026-10-19T08:00:00Z");
    prisma.notification.findFirst.mockResolvedValue({ readAt: firstRead });
    prisma.notification.update.mockImplementation(async ({ data }) => row(data));
    prisma.notification.count.mockResolvedValue(0);

    await patch("/notifications/1", { read: true });

    expect(prisma.notification.update.mock.calls[0][0].data.readAt).toBe(firstRead);
  });

  test("read: false marks it unread again", async () => {
    prisma.notification.findFirst.mockResolvedValue({ readAt: new Date() });
    prisma.notification.update.mockImplementation(async ({ data }) => row(data));
    prisma.notification.count.mockResolvedValue(1);

    const res = await patch("/notifications/1", { read: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notification marked unread");
    expect(prisma.notification.update.mock.calls[0][0].data).toEqual({ readAt: null });
  });

  test("another user's notification answers exactly like a missing one (404)", async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    const res = await patch("/notifications/99", { read: true });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.message).toBe("No notification exists with ID 99");
    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(hub.publish).not.toHaveBeenCalled();
  });

  test.each([
    ["abc", { read: true }, "id must be a positive integer"],
    ["0", { read: true }, "id must be a positive integer"],
    ["1", {}, "read must be true or false"],
    ["1", { read: "true" }, "read must be true or false"],
  ])("400 for id %s, body %j", async (id, body, message) => {
    const res = await patch(`/notifications/${id}`, body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });

  test("a failed push doesn't fail the request", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    prisma.notification.findFirst.mockResolvedValue({ readAt: null });
    prisma.notification.update.mockImplementation(async ({ data }) => row(data));
    prisma.notification.count.mockResolvedValue(0);
    hub.publish.mockImplementation(() => {
      throw new Error("socket gone");
    });

    const res = await patch("/notifications/1", { read: true });

    expect(res.status).toBe(200);
    consoleErrorSpy.mockRestore();
  });
});

describe("PATCH /api/v1/notifications (mark all read)", () => {
  test("marks only the caller's unread ones, and pushes a zero count", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const res = await patch("/notifications", { read: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 3, unreadCount: 0 });
    const { where, data } = prisma.notification.updateMany.mock.calls[0][0];
    expect(where).toEqual({ userID: USER_ID, readAt: null });
    expect(data.readAt).toBeInstanceOf(Date);
    expect(hub.publish).toHaveBeenCalledWith(USER_ID, "unread-count", { unreadCount: 0 });
  });

  test.each([[{}], [{ read: false }], [{ read: "true" }]])(
    "400 for %j — marking everything unread isn't offered",
    async (body) => {
      const res = await patch("/notifications", body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("read must be true");
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe("a database error", () => {
  test.each([
    ["GET /notifications", () => get("/notifications"), "findMany"],
    ["GET /notifications/unread-count", () => get("/notifications/unread-count"), "count"],
    ["PATCH /notifications/:id", () => patch("/notifications/1", { read: true }), "findFirst"],
    ["PATCH /notifications", () => patch("/notifications", { read: true }), "updateMany"],
  ])("%s → 500 in the standard envelope", async (_label, send, method) => {
    prisma.notification[method].mockRejectedValue(new Error("connection lost"));
    prisma.notification.count.mockRejectedValue(new Error("connection lost"));
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await send();

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: { code: "INTERNAL_SERVER_ERROR" } });
    consoleErrorSpy.mockRestore();
  });
});
