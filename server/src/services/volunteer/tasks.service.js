const prisma = require("../../config/prisma");
const { TASK_SELECT, formatTask } = require("../staff/tasks.service");

// A volunteer's own tasks — only those they're assigned to through
// VolunteerTask. Same select, item shape and derived status (Overdue) as the
// Staff Tasks tab (staff/tasks.service.js).

const notFound = (taskID) => {
  const err = new Error(`No task exists with ID ${taskID}`);
  err.code = "NOT_FOUND";
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  return err;
};

const assignedTo = (volunteerID) => ({
  volunteers: { some: { volunteerID } },
});

// ——————————————— GET /volunteers/me/tasks ———————————————
// upcoming: true → due now or later (or no due date), soonest first;
// false → due date passed, most recent first; undefined → every task,
// soonest due first. taskStatus filters the stored enum.
const listMyTasks = async (
  volunteerID,
  { taskStatus, upcoming, page = 1, limit = 20 } = {},
) => {
  const now = new Date();
  const where = { ...assignedTo(volunteerID) };
  if (taskStatus) {
    where.taskStatus = taskStatus;
  }
  if (upcoming === true) {
    where.OR = [{ taskDue: { gte: now } }, { taskDue: null }];
  } else if (upcoming === false) {
    where.taskDue = { lt: now };
  }

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: { taskDue: upcoming === false ? "desc" : "asc" },
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

// ——————————————— PATCH /volunteers/me/tasks/:id/status ———————————————
// A volunteer can only mark their own open task Completed (cancelling is
// staff's). A task they aren't assigned to answers exactly like a missing
// one (404), so they can't probe other volunteers' tasks.
const completeMyTask = async (volunteerID, taskID) => {
  const task = await prisma.task.findFirst({
    where: { taskID, ...assignedTo(volunteerID) },
    select: { taskStatus: true },
  });
  if (!task) {
    throw notFound(taskID);
  }
  if (task.taskStatus !== "In_progress") {
    throw conflict(`A ${task.taskStatus} task can't be moved to Completed`);
  }

  // Guarded on In_progress again so a staff cancel landing in between
  // isn't overwritten.
  const { count } = await prisma.task.updateMany({
    where: { taskID, taskStatus: "In_progress" },
    data: { taskStatus: "Completed" },
  });
  if (count === 0) {
    throw conflict("This task is no longer in progress");
  }

  return formatTask(
    await prisma.task.findUnique({ where: { taskID }, select: TASK_SELECT }),
  );
};

module.exports = { listMyTasks, completeMyTask };
