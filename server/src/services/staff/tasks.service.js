const { TaskName } = require("@prisma/client");
const prisma = require("../../config/prisma");

// taskName is the TaskName enum — validated strictly in the controller
// against these generated values (client/src/logic/staff/tasks.ts holds the
// display labels).
const TASK_NAMES = Object.values(TaskName);

const notFound = (taskID) => {
  const err = new Error(`No task exists with ID ${taskID}`);
  err.code = "NOT_FOUND";
  return err;
};

const shelterNotFound = (shelterID) => {
  const err = new Error(`No shelter exists with ID ${shelterID}`);
  err.code = "NOT_FOUND";
  return err;
};

const noShelterAssigned = () => {
  const err = new Error(
    "You must be assigned to a shelter before you can create tasks",
  );
  err.code = "CONFLICT";
  return err;
};

const forbiddenShelter = () => {
  const err = new Error("You may only act on tasks at your own shelter");
  err.code = "FORBIDDEN";
  return err;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

// Same convention as the other staff/*.service.js files' own copies —
// duplicated locally rather than shared.
const assertStaffOwnsShelter = async (role, userID, shelterID) => {
  if (role !== "Staff") return;
  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (shelterID !== staff?.shelterID) {
    throw forbiddenShelter();
  }
};

const resolveShelterIDForCreate = async ({ role, userID }, requestedShelterID) => {
  if (role === "Admin") {
    const shelter = await prisma.shelter.findUnique({
      where: { shelterID: requestedShelterID },
      select: { shelterID: true },
    });
    if (!shelter) {
      throw shelterNotFound(requestedShelterID);
    }
    return requestedShelterID;
  }

  const staff = await prisma.staff.findUnique({
    where: { userID },
    select: { shelterID: true },
  });
  if (!staff?.shelterID) {
    throw noShelterAssigned();
  }
  return staff.shelterID;
};

// Every assignee must be an Active volunteer at the task's shelter.
const assertVolunteersAtShelter = async (shelterID, volunteerIDs) => {
  const count = await prisma.volunteer.count({
    where: { userID: { in: volunteerIDs }, shelterID, accountStatus: "Active" },
  });
  if (count !== volunteerIDs.length) {
    throw badRequest(
      "volunteerIDs must all reference active volunteers at this shelter",
    );
  }
};

// "Overdue" is never stored — an In_progress task whose due date has passed
// just displays as Overdue, same derived-status approach as
// appointments.service.js's deriveAppointmentStatus.
const deriveTaskStatus = (row) =>
  row.taskStatus === "In_progress" && row.taskDue && row.taskDue < new Date()
    ? "Overdue"
    : row.taskStatus;

const TASK_SELECT = {
  taskID: true,
  taskName: true,
  taskDesc: true,
  taskDate: true,
  taskDue: true,
  taskStatus: true,
  shelterID: true,
  staff: { select: { staffName: true } },
  volunteers: {
    select: { volunteer: { select: { userID: true, volunteerName: true } } },
    orderBy: { volunteer: { volunteerName: "asc" } },
  },
};

const formatTask = (row) => ({
  taskID: row.taskID,
  taskName: row.taskName,
  taskDesc: row.taskDesc,
  taskDate: row.taskDate,
  taskDue: row.taskDue,
  taskStatus: row.taskStatus,
  status: deriveTaskStatus(row),
  staffName: row.staff?.staffName ?? null,
  volunteers: row.volunteers.map((v) => ({
    volunteerID: v.volunteer.userID,
    volunteerName: v.volunteer.volunteerName,
  })),
});

// ——————————————— LIST TASKS (GET /tasks) ———————————————
// taskStatus filters the stored enum; dueFrom/dueTo (client-computed, so
// "today"/"this week" follow the viewer's timezone) and overdue filter the
// due date; volunteerName matches any assignee.
const listTasks = async (
  actor,
  {
    taskStatus,
    dueFrom,
    dueTo,
    overdue,
    volunteerName,
    shelterID: shelterIDParam,
    page = 1,
    limit = 20,
  } = {},
) => {
  const where = {};

  if (actor.role === "Staff") {
    const staff = await prisma.staff.findUnique({
      where: { userID: actor.userID },
      select: { shelterID: true },
    });
    // No shelter assigned -> a sentinel that can never match.
    where.shelterID = staff?.shelterID ?? -1;
  } else if (shelterIDParam !== undefined) {
    where.shelterID = shelterIDParam;
  }
  // Admin with no shelterID param: unscoped, network-wide.

  if (taskStatus) {
    where.taskStatus = taskStatus;
  }

  if (overdue) {
    where.taskStatus = "In_progress";
    where.taskDue = { lt: new Date() };
  } else if (dueFrom || dueTo) {
    where.taskDue = {
      ...(dueFrom && { gte: dueFrom }),
      ...(dueTo && { lt: dueTo }),
    };
  }

  if (volunteerName) {
    where.volunteers = {
      some: {
        volunteer: { volunteerName: { contains: volunteerName, mode: "insensitive" } },
      },
    };
  }

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: { taskDue: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    data: rows.map(formatTask),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ——————————————— TASK DETAIL (GET /tasks/:id) ———————————————
const getTaskDetail = async (taskID, actor) => {
  const task = await prisma.task.findUnique({
    where: { taskID },
    select: TASK_SELECT,
  });
  if (!task) {
    throw notFound(taskID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, task.shelterID);

  return formatTask(task);
};

// ——————————————— CREATE TASK (POST /tasks) ———————————————
// taskDate is the assignment date (now); staffID is the creating staff member.
const createTask = async ({ data, actor, requestedShelterID }) => {
  const shelterID = await resolveShelterIDForCreate(actor, requestedShelterID);
  await assertVolunteersAtShelter(shelterID, data.volunteerIDs);

  const task = await prisma.task.create({
    data: {
      taskName: data.taskName,
      taskDesc: data.taskDesc,
      taskDue: data.taskDue,
      taskDate: new Date(),
      taskStatus: "In_progress",
      shelterID,
      staffID: actor.role === "Staff" ? actor.userID : null,
      volunteers: {
        create: data.volunteerIDs.map((volunteerID) => ({ volunteerID })),
      },
    },
    select: { taskID: true },
  });

  return getTaskDetail(task.taskID, actor);
};

// ——————————————— UPDATE TASK (PATCH /tasks/:id) ———————————————
// Open (In_progress, incl. overdue) tasks only. Partial; volunteerIDs, when
// sent, replaces the whole assignee set.
const updateTask = async (taskID, data, actor) => {
  const task = await prisma.task.findUnique({
    where: { taskID },
    select: { shelterID: true, taskStatus: true },
  });
  if (!task) {
    throw notFound(taskID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, task.shelterID);

  if (task.taskStatus !== "In_progress") {
    throw conflict(`A ${task.taskStatus} task can't be edited`);
  }

  const { volunteerIDs, ...fields } = data;
  if (volunteerIDs) {
    await assertVolunteersAtShelter(task.shelterID, volunteerIDs);
  }

  await prisma.$transaction([
    prisma.task.update({ where: { taskID }, data: fields }),
    ...(volunteerIDs
      ? [
          prisma.volunteerTask.deleteMany({ where: { taskID } }),
          prisma.volunteerTask.createMany({
            data: volunteerIDs.map((volunteerID) => ({ taskID, volunteerID })),
          }),
        ]
      : []),
  ]);

  return getTaskDetail(taskID, actor);
};

// ——————————————— UPDATE STATUS (PATCH /tasks/:id/status) ———————————————
// Complete or cancel an open task.
const updateTaskStatus = async (taskID, { taskStatus }, actor) => {
  const task = await prisma.task.findUnique({
    where: { taskID },
    select: { shelterID: true, taskStatus: true },
  });
  if (!task) {
    throw notFound(taskID);
  }

  await assertStaffOwnsShelter(actor.role, actor.userID, task.shelterID);

  if (task.taskStatus !== "In_progress") {
    throw conflict(`A ${task.taskStatus} task can't be moved to ${taskStatus}`);
  }

  await prisma.task.update({ where: { taskID }, data: { taskStatus } });

  return getTaskDetail(taskID, actor);
};

module.exports = {
  TASK_NAMES,
  listTasks,
  getTaskDetail,
  createTask,
  updateTask,
  updateTaskStatus,
};
