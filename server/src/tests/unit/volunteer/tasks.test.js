const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  task: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 30) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const volunteerToken = () => signToken("Volunteer");

const DAY = 24 * 60 * 60 * 1000;

// Matches TASK_SELECT in staff/tasks.service.js.
const taskRow = (overrides = {}) => ({
  taskID: 7,
  taskName: "Feeding",
  taskDesc: "Morning feed for the kennels",
  taskDate: new Date("2026-09-30T09:00:00Z"),
  taskDue: new Date(Date.now() + 2 * DAY),
  taskStatus: "In_progress",
  shelterID: 9,
  staff: { staffName: "Sasha Lee" },
  volunteers: [
    { volunteer: { userID: 30, volunteerName: "Val Volunteer" } },
    { volunteer: { userID: 31, volunteerName: "Wes Walker" } },
  ],
  ...overrides,
});

describe("Volunteer tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  // ————————————————————————————— GET /volunteers/me/tasks —————————————————————————————
  describe("GET /api/v1/volunteers/me/tasks", () => {
    const list = (query = {}) =>
      request(app)
        .get("/api/v1/volunteers/me/tasks")
        .query(query)
        .set("Authorization", `Bearer ${volunteerToken()}`);

    test("only tasks the caller is assigned to, Staff Tasks item shape (incl. derived status)", async () => {
      prisma.task.findMany.mockResolvedValueOnce([
        taskRow(),
        taskRow({ taskID: 8, taskDue: new Date(Date.now() - DAY) }), // overdue
      ]);
      prisma.task.count.mockResolvedValueOnce(2);

      const res = await list();

      expect(res.status).toBe(200);
      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ volunteers: { some: { volunteerID: 30 } } });
      expect(args.orderBy).toEqual({ taskDue: "asc" });
      expect(res.body.data[0]).toEqual({
        taskID: 7,
        taskName: "Feeding",
        taskDesc: "Morning feed for the kennels",
        taskDate: "2026-09-30T09:00:00.000Z",
        taskDue: expect.any(String),
        taskStatus: "In_progress",
        status: "In_progress",
        staffName: "Sasha Lee",
        volunteers: [
          { volunteerID: 30, volunteerName: "Val Volunteer" },
          { volunteerID: 31, volunteerName: "Wes Walker" },
        ],
      });
      expect(res.body.data[1].status).toBe("Overdue");
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    });

    test("upcoming=true → due now or later (or no due date), soonest first", async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(0);

      await list({ upcoming: "true" });

      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { taskDue: { gte: expect.any(Date) } },
        { taskDue: null },
      ]);
      expect(args.orderBy).toEqual({ taskDue: "asc" });
    });

    test("upcoming=false → due date passed, most recent first", async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(0);

      await list({ upcoming: "false" });

      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where.taskDue).toEqual({ lt: expect.any(Date) });
      expect(args.where.OR).toBeUndefined();
      expect(args.orderBy).toEqual({ taskDue: "desc" });
    });

    test("taskStatus filters; page/limit paginate", async () => {
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(12);

      const res = await list({ taskStatus: "Completed", page: 2, limit: 5 });

      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        volunteers: { some: { volunteerID: 30 } },
        taskStatus: "Completed",
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    test.each([
      [{ taskStatus: "Overdue" }, "taskStatus"],
      [{ upcoming: "yes" }, "upcoming"],
      [{ page: 0 }, "page"],
      [{ limit: 101 }, "limit"],
    ])("invalid %j → 400, nothing read", async (query, field) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— PATCH /volunteers/me/tasks/:id/status —————————————————————————————
  describe("PATCH /api/v1/volunteers/me/tasks/:id/status", () => {
    const complete = (body = { taskStatus: "Completed" }, id = 7) =>
      request(app)
        .patch(`/api/v1/volunteers/me/tasks/${id}/status`)
        .set("Authorization", `Bearer ${volunteerToken()}`)
        .send(body);

    test("own open task → Completed, the updated task back", async () => {
      prisma.task.findFirst.mockResolvedValueOnce({ taskStatus: "In_progress" });
      prisma.task.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.task.findUnique.mockResolvedValueOnce(taskRow({ taskStatus: "Completed" }));

      const res = await complete();

      expect(res.status).toBe(200);
      expect(prisma.task.findFirst.mock.calls[0][0].where).toEqual({
        taskID: 7,
        volunteers: { some: { volunteerID: 30 } },
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { taskID: 7, taskStatus: "In_progress" },
        data: { taskStatus: "Completed" },
      });
      expect(res.body.data).toMatchObject({ taskID: 7, taskStatus: "Completed", status: "Completed" });
    });

    test("an overdue task can still be completed", async () => {
      prisma.task.findFirst.mockResolvedValueOnce({ taskStatus: "In_progress" });
      prisma.task.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.task.findUnique.mockResolvedValueOnce(
        taskRow({ taskStatus: "Completed", taskDue: new Date(Date.now() - DAY) }),
      );

      const res = await complete();

      expect(res.status).toBe(200);
    });

    test("another volunteer's (or a missing) task → 404, nothing written", async () => {
      prisma.task.findFirst.mockResolvedValueOnce(null);

      const res = await complete(undefined, 99);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No task exists with ID 99");
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    test.each(["Completed", "Cancelled"])("already %s → 409, nothing written", async (taskStatus) => {
      prisma.task.findFirst.mockResolvedValueOnce({ taskStatus });

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(`A ${taskStatus} task can't be moved to Completed`);
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    test("lost a race (staff cancelled it in between) → 409", async () => {
      prisma.task.findFirst.mockResolvedValueOnce({ taskStatus: "In_progress" });
      prisma.task.updateMany.mockResolvedValueOnce({ count: 0 });

      const res = await complete();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("This task is no longer in progress");
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });

    test.each([
      ["Cancelled (staff only)", { taskStatus: "Cancelled" }],
      ["In_progress", { taskStatus: "In_progress" }],
      ["missing taskStatus", {}],
    ])("%s → 400, nothing read", async (_label, body) => {
      const res = await complete(body);

      expect(res.status).toBe(400);
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });

    test("non-numeric id → 400, nothing read", async () => {
      const res = await complete(undefined, "abc");

      expect(res.status).toBe(400);
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });
  });

  // ————————————————————————————— ACCESS —————————————————————————————
  describe("access", () => {
    test.each([
      ["get", "/api/v1/volunteers/me/tasks"],
      ["patch", "/api/v1/volunteers/me/tasks/7/status"],
    ])("%s %s: Staff → 403, nothing read", async (method, path) => {
      const res = await request(app)
        [method](path)
        .set("Authorization", `Bearer ${signToken("Staff", 42)}`)
        .send({ taskStatus: "Completed" });

      expect(res.status).toBe(403);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });

    test("a Pending volunteer → 401", async () => {
      authService.getAccountStatus.mockResolvedValue("Pending");

      const res = await request(app)
        .get("/api/v1/volunteers/me/tasks")
        .set("Authorization", `Bearer ${volunteerToken()}`);

      expect(res.status).toBe(401);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });
});
