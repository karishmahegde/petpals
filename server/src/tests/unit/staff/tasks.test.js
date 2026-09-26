const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mocked so this suite never touches a real database.
jest.mock("../../../config/prisma", () => ({
  staff: { findUnique: jest.fn() },
  shelter: { findUnique: jest.fn() },
  volunteer: { count: jest.fn() },
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  volunteerTask: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
}));

// Only getAccountStatus is faked (authenticate.js's live per-request check).
jest.mock("../../../services/auth/auth.service", () => ({
  ...jest.requireActual("../../../services/auth/auth.service"),
  getAccountStatus: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const authService = require("../../../services/auth/auth.service");
const app = require("../../../app");

const signToken = (role, userID = 42) =>
  jwt.sign({ userID, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const staffToken = () => signToken("Staff", 42);
const adminToken = () => signToken("Admin", 1);
const adopterToken = () => signToken("Adopter", 7);

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

const taskRow = (overrides = {}) => ({
  taskID: 5,
  taskName: "Feeding",
  taskDesc: "Morning feed, kennel block B",
  taskDate: new Date("2026-09-20"),
  taskDue: FUTURE,
  taskStatus: "In_progress",
  shelterID: 9,
  staff: { staffName: "Sam Staff" },
  volunteers: [{ volunteer: { userID: 30, volunteerName: "Val Volunteer" } }],
  ...overrides,
});

const VALID_BODY = () => ({
  taskName: "Feeding",
  taskDesc: "  Morning feed, kennel block B  ",
  taskDue: FUTURE.toISOString(),
  volunteerIDs: [30, 31, 30],
});

describe("Tasks (Staff)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authService.getAccountStatus.mockResolvedValue("Active");
  });

  describe("GET /api/v1/tasks", () => {
    test("Staff: scoped to own shelter, due-date ascending, formatted with derived status", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.task.findMany.mockResolvedValueOnce([
        taskRow({ taskID: 1, taskDue: PAST }),
        taskRow({ taskID: 2 }),
        taskRow({ taskID: 3, taskDue: PAST, taskStatus: "Completed" }),
      ]);
      prisma.task.count.mockResolvedValueOnce(3);

      const res = await request(app)
        .get("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ shelterID: 9 });
      expect(args.orderBy).toEqual({ taskDue: "asc" });
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);

      // Overdue is derived, never stored: only an In_progress task past its due date.
      expect(res.body.data.map((t) => [t.taskStatus, t.status])).toEqual([
        ["In_progress", "Overdue"],
        ["In_progress", "In_progress"],
        ["Completed", "Completed"],
      ]);
      expect(res.body.data[1]).toMatchObject({
        taskID: 2,
        taskName: "Feeding",
        staffName: "Sam Staff",
        volunteers: [{ volunteerID: 30, volunteerName: "Val Volunteer" }],
      });
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    });

    test("Staff with no shelter -> sentinel shelterID -1 (never matches)", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .get("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.task.findMany.mock.calls[0][0].where.shelterID).toBe(-1);
    });

    test("Staff: shelterID query param is ignored (always own shelter)", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/tasks")
        .query({ shelterID: 77 })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(prisma.task.findMany.mock.calls[0][0].where.shelterID).toBe(9);
    });

    test("Admin: unscoped by default, shelterID param narrows", async () => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      await request(app)
        .get("/api/v1/tasks")
        .set("Authorization", `Bearer ${adminToken()}`);
      await request(app)
        .get("/api/v1/tasks")
        .query({ shelterID: 77 })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({});
      expect(prisma.task.findMany.mock.calls[1][0].where).toEqual({ shelterID: 77 });
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("taskStatus, dueFrom/dueTo, volunteerName and pagination build the where clause", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(45);

      const res = await request(app)
        .get("/api/v1/tasks")
        .query({
          taskStatus: "Completed",
          dueFrom: "2026-09-01T00:00:00.000Z",
          dueTo: "2026-09-08T00:00:00.000Z",
          volunteerName: "val",
          page: 3,
          limit: 10,
        })
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      const args = prisma.task.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        shelterID: 9,
        taskStatus: "Completed",
        taskDue: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lt: new Date("2026-09-08T00:00:00.000Z"),
        },
        volunteers: {
          some: { volunteer: { volunteerName: { contains: "val", mode: "insensitive" } } },
        },
      });
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      expect(res.body.pagination).toEqual({ page: 3, limit: 10, total: 45, totalPages: 5 });
    });

    test("overdue=true -> In_progress with taskDue < now, overriding taskStatus and due range", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.task.findMany.mockResolvedValueOnce([]);
      prisma.task.count.mockResolvedValueOnce(0);

      await request(app)
        .get("/api/v1/tasks")
        .query({ overdue: "true", taskStatus: "Completed", dueFrom: "2026-09-01" })
        .set("Authorization", `Bearer ${staffToken()}`);

      const { where } = prisma.task.findMany.mock.calls[0][0];
      expect(where.taskStatus).toBe("In_progress");
      expect(Object.keys(where.taskDue)).toEqual(["lt"]);
      expect(where.taskDue.lt).toBeInstanceOf(Date);
    });

    test.each([
      [{ taskStatus: "Overdue" }, "taskStatus"],
      [{ dueFrom: "not-a-date" }, "dueFrom"],
      [{ dueTo: "nope" }, "dueTo"],
      [{ page: 0 }, "page"],
      [{ limit: 101 }, "limit"],
    ])("invalid %j -> 400", async (query, field) => {
      const res = await request(app)
        .get("/api/v1/tasks")
        .query(query)
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    test("Admin: invalid shelterID -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/tasks")
        .query({ shelterID: "abc" })
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
    });

    test("Adopter -> 403", async () => {
      const res = await request(app)
        .get("/api/v1/tasks")
        .set("Authorization", `Bearer ${adopterToken()}`);

      expect(res.status).toBe(403);
    });

    test("no token -> 401", async () => {
      const res = await request(app).get("/api/v1/tasks");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/tasks/:id", () => {
    test("own shelter's task -> 200", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(taskRow());
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .get("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ taskID: 5, status: "In_progress" });
    });

    test("another shelter's task -> 403", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(taskRow({ shelterID: 10 }));
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });

      const res = await request(app)
        .get("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(403);
    });

    test("Admin sees any shelter's task without a staff lookup", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(taskRow({ shelterID: 10 }));

      const res = await request(app)
        .get("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    test("unknown id -> 404", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/tasks/999")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(404);
    });

    test("non-numeric id -> 400", async () => {
      const res = await request(app)
        .get("/api/v1/tasks/abc")
        .set("Authorization", `Bearer ${staffToken()}`);

      expect(res.status).toBe(400);
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/tasks", () => {
    test("Staff: created In_progress at own shelter, desc trimmed, volunteerIDs deduped -> 201", async () => {
      prisma.staff.findUnique
        .mockResolvedValueOnce({ shelterID: 9 }) // resolve shelter
        .mockResolvedValueOnce({ shelterID: 9 }); // detail ownership check
      prisma.volunteer.count.mockResolvedValueOnce(2);
      prisma.task.create.mockResolvedValueOnce({ taskID: 5 });
      prisma.task.findUnique.mockResolvedValueOnce(taskRow());

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_BODY());

      expect(res.status).toBe(201);
      expect(res.body.data.taskID).toBe(5);

      expect(prisma.volunteer.count).toHaveBeenCalledWith({
        where: { userID: { in: [30, 31] }, shelterID: 9, accountStatus: "Active" },
      });
      const { data } = prisma.task.create.mock.calls[0][0];
      expect(data).toMatchObject({
        taskName: "Feeding",
        taskDesc: "Morning feed, kennel block B",
        taskStatus: "In_progress",
        shelterID: 9,
        staffID: 42,
        volunteers: { create: [{ volunteerID: 30 }, { volunteerID: 31 }] },
      });
      expect(data.taskDate).toBeInstanceOf(Date);
    });

    test("Staff with no shelter -> 409", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: null });

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_BODY());

      expect(res.status).toBe(409);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    test("a volunteer not Active at this shelter -> 400, nothing created", async () => {
      prisma.staff.findUnique.mockResolvedValueOnce({ shelterID: 9 });
      prisma.volunteer.count.mockResolvedValueOnce(1);

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send(VALID_BODY());

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active volunteers at this shelter/);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    test("Admin: shelterID required, staffID left null", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce({ shelterID: 77 });
      prisma.volunteer.count.mockResolvedValueOnce(2);
      prisma.task.create.mockResolvedValueOnce({ taskID: 5 });
      prisma.task.findUnique.mockResolvedValueOnce(taskRow({ shelterID: 77, staff: null }));

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_BODY(), shelterID: 77 });

      expect(res.status).toBe(201);
      expect(prisma.task.create.mock.calls[0][0].data).toMatchObject({
        shelterID: 77,
        staffID: null,
      });
      expect(res.body.data.staffName).toBeNull();
    });

    test("Admin: missing shelterID -> 400", async () => {
      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send(VALID_BODY());

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("shelterID");
    });

    test("Admin: unknown shelterID -> 404", async () => {
      prisma.shelter.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ ...VALID_BODY(), shelterID: 999 });

      expect(res.status).toBe(404);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    test.each([
      [{ taskName: "Walking" }, "taskName"],
      [{ taskName: undefined }, "taskName"],
      [{ taskDesc: "   " }, "taskDesc"],
      [{ taskDesc: "x".repeat(301) }, "taskDesc"],
      [{ taskDue: "not-a-date" }, "taskDue"],
      [{ taskDue: undefined }, "taskDue"],
      [{ taskDue: PAST.toISOString() }, "taskDue must not be in the past"],
      [{ volunteerIDs: [] }, "volunteerIDs"],
      [{ volunteerIDs: "30" }, "volunteerIDs"],
      [{ volunteerIDs: [30, "abc"] }, "volunteerIDs[]"],
    ])("invalid body %j -> 400", async (override, message) => {
      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ ...VALID_BODY(), ...override });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    test("Adopter -> 403", async () => {
      const res = await request(app)
        .post("/api/v1/tasks")
        .set("Authorization", `Bearer ${adopterToken()}`)
        .send(VALID_BODY());

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/tasks/:id", () => {
    test("partial update of fields only -> no assignee rewrite", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ shelterID: 9, taskStatus: "In_progress" })
        .mockResolvedValueOnce(taskRow({ taskName: "Cleaning" }));
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.$transaction.mockResolvedValueOnce([]);

      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskName: "Cleaning" });

      expect(res.status).toBe(200);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { taskID: 5 },
        data: { taskName: "Cleaning" },
      });
      expect(prisma.volunteer.count).not.toHaveBeenCalled();
      expect(prisma.volunteerTask.deleteMany).not.toHaveBeenCalled();
      expect(prisma.volunteerTask.createMany).not.toHaveBeenCalled();
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(1);
    });

    test("volunteerIDs replaces the whole assignee set in one transaction", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ shelterID: 9, taskStatus: "In_progress" })
        .mockResolvedValueOnce(taskRow());
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.volunteer.count.mockResolvedValueOnce(1);
      prisma.$transaction.mockResolvedValueOnce([]);

      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ volunteerIDs: [31] });

      expect(res.status).toBe(200);
      expect(prisma.volunteerTask.deleteMany).toHaveBeenCalledWith({ where: { taskID: 5 } });
      expect(prisma.volunteerTask.createMany).toHaveBeenCalledWith({
        data: [{ taskID: 5, volunteerID: 31 }],
      });
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    });

    test("new assignee not Active at the task's shelter -> 400, no write", async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ shelterID: 9, taskStatus: "In_progress" });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });
      prisma.volunteer.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ volunteerIDs: [99] });

      expect(res.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test.each(["Completed", "Cancelled"])("%s task -> 409", async (taskStatus) => {
      prisma.task.findUnique.mockResolvedValueOnce({ shelterID: 9, taskStatus });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskDesc: "Updated" });

      expect(res.status).toBe(409);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("another shelter's task -> 403", async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ shelterID: 10, taskStatus: "In_progress" });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskDesc: "Updated" });

      expect(res.status).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("unknown id -> 404", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/tasks/999")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskDesc: "Updated" });

      expect(res.status).toBe(404);
    });

    test("empty body -> 400", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one of/);
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });

    test("past taskDue -> 400", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/5")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskDue: PAST.toISOString() });

      expect(res.status).toBe(400);
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/v1/tasks/:id/status", () => {
    test.each(["Completed", "Cancelled"])("In_progress -> %s", async (taskStatus) => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ shelterID: 9, taskStatus: "In_progress" })
        .mockResolvedValueOnce(taskRow({ taskStatus }));
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskStatus });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(`Task ${taskStatus.toLowerCase()} successfully`);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { taskID: 5 },
        data: { taskStatus },
      });
      expect(res.body.data.status).toBe(taskStatus);
    });

    test("an overdue (In_progress, past due) task can still be completed", async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce({ shelterID: 9, taskStatus: "In_progress" })
        .mockResolvedValueOnce(taskRow({ taskStatus: "Completed", taskDue: PAST }));
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskStatus: "Completed" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("Completed");
    });

    test("already closed task -> 409", async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ shelterID: 9, taskStatus: "Cancelled" });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskStatus: "Completed" });

      expect(res.status).toBe(409);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    test("another shelter's task -> 403", async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ shelterID: 10, taskStatus: "In_progress" });
      prisma.staff.findUnique.mockResolvedValue({ shelterID: 9 });

      const res = await request(app)
        .patch("/api/v1/tasks/5/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskStatus: "Completed" });

      expect(res.status).toBe(403);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    test("unknown id -> 404", async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/v1/tasks/999/status")
        .set("Authorization", `Bearer ${staffToken()}`)
        .send({ taskStatus: "Completed" });

      expect(res.status).toBe(404);
    });

    test.each([undefined, "In_progress", "Overdue"])(
      "taskStatus %s -> 400",
      async (taskStatus) => {
        const res = await request(app)
          .patch("/api/v1/tasks/5/status")
          .set("Authorization", `Bearer ${staffToken()}`)
          .send({ taskStatus });

        expect(res.status).toBe(400);
        expect(prisma.task.findUnique).not.toHaveBeenCalled();
      },
    );
  });
});
