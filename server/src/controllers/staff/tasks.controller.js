const tasksService = require("../../services/staff/tasks.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const parseId = (value, field) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`${field} is required and must be a positive integer`);
  }
  return n;
};

const MAX_DESC_LEN = 300; // schema.prisma: taskDesc is VarChar(300)
const VALID_STATUS_FILTERS = ["In_progress", "Completed", "Cancelled"];
const VALID_TARGET_STATUSES = ["Completed", "Cancelled"];

// Field parsers shared by create (all required) and update (only those sent).
const parseTaskName = (value) => {
  if (!tasksService.TASK_NAMES.includes(value)) {
    throw badRequest(`taskName must be one of: ${tasksService.TASK_NAMES.join(", ")}`);
  }
  return value;
};

const parseTaskDesc = (value) => {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_DESC_LEN) {
    throw badRequest(
      `taskDesc must be a non-empty string of at most ${MAX_DESC_LEN} characters`,
    );
  }
  return value.trim();
};

const parseTaskDue = (value) => {
  const date = new Date(value);
  if (value === undefined || value === null || Number.isNaN(date.getTime())) {
    throw badRequest("taskDue must be a valid date");
  }
  if (date.getTime() < Date.now()) {
    throw badRequest("taskDue must not be in the past");
  }
  return date;
};

const parseVolunteerIDs = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest("volunteerIDs must be a non-empty array");
  }
  return [...new Set(value.map((id) => parseId(id, "volunteerIDs[]")))];
};

const parseOptionalDate = (value, field) => {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
};

// ——————————————— GET /tasks ———————————————
const listTasks = async (req, res, next) => {
  const {
    taskStatus,
    overdue: overdueRaw,
    volunteerName,
    shelterID: shelterIDRaw,
    page: pageRaw,
    limit: limitRaw,
  } = req.query;

  if (taskStatus !== undefined && !VALID_STATUS_FILTERS.includes(taskStatus)) {
    return next(
      badRequest(`taskStatus must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
    );
  }

  let dueFrom;
  let dueTo;
  try {
    dueFrom = parseOptionalDate(req.query.dueFrom, "dueFrom");
    dueTo = parseOptionalDate(req.query.dueTo, "dueTo");
  } catch (err) {
    return next(err);
  }

  let page = 1;
  if (pageRaw !== undefined) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return next(badRequest("page must be an integer >= 1"));
    }
  }

  let limit = 20;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return next(badRequest("limit must be an integer between 1 and 100"));
    }
  }

  // Only meaningful for Admin — a Staff caller's shelter is always their
  // own, resolved server-side in the service, never from a query param.
  let shelterID;
  if (req.user.role === "Admin" && shelterIDRaw !== undefined) {
    shelterID = Number(shelterIDRaw);
    if (!Number.isInteger(shelterID) || shelterID < 1) {
      return next(badRequest("shelterID must be a positive integer"));
    }
  }

  try {
    const result = await tasksService.listTasks(
      { role: req.user.role, userID: req.user.userID },
      {
        taskStatus,
        dueFrom,
        dueTo,
        overdue: overdueRaw === "true",
        volunteerName,
        shelterID,
        page,
        limit,
      },
    );
    return successListResponse(
      res,
      "Tasks retrieved successfully",
      result.data,
      result.pagination,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /tasks/:id ———————————————
const getTask = async (req, res, next) => {
  let taskID;
  try {
    taskID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  try {
    const task = await tasksService.getTaskDetail(taskID, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Task retrieved successfully", task);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— POST /tasks ———————————————
const createTask = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  let data;
  let requestedShelterID;
  try {
    data = {
      taskName: parseTaskName(body.taskName),
      taskDesc: parseTaskDesc(body.taskDesc),
      taskDue: parseTaskDue(body.taskDue),
      volunteerIDs: parseVolunteerIDs(body.volunteerIDs),
    };
    // Staff always creates at their own shelter; Admin has no home shelter.
    if (req.user.role === "Admin") {
      requestedShelterID = parseId(body.shelterID, "shelterID");
    }
  } catch (err) {
    return next(err);
  }

  try {
    const task = await tasksService.createTask({
      data,
      actor: { role: req.user.role, userID: req.user.userID },
      requestedShelterID,
    });
    return successResponse(res, "Task created successfully", task, 201);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /tasks/:id ———————————————
const updateTask = async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  let taskID;
  const data = {};
  try {
    taskID = parseId(req.params.id, "id");
    if (body.taskName !== undefined) data.taskName = parseTaskName(body.taskName);
    if (body.taskDesc !== undefined) data.taskDesc = parseTaskDesc(body.taskDesc);
    if (body.taskDue !== undefined) data.taskDue = parseTaskDue(body.taskDue);
    if (body.volunteerIDs !== undefined) {
      data.volunteerIDs = parseVolunteerIDs(body.volunteerIDs);
    }
  } catch (err) {
    return next(err);
  }

  if (Object.keys(data).length === 0) {
    return next(
      badRequest("Provide at least one of: taskName, taskDesc, taskDue, volunteerIDs"),
    );
  }

  try {
    const task = await tasksService.updateTask(taskID, data, {
      role: req.user.role,
      userID: req.user.userID,
    });
    return successResponse(res, "Task updated successfully", task);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /tasks/:id/status ———————————————
const updateTaskStatus = async (req, res, next) => {
  let taskID;
  try {
    taskID = parseId(req.params.id, "id");
  } catch (err) {
    return next(err);
  }

  const { taskStatus } = req.body ?? {};
  if (!VALID_TARGET_STATUSES.includes(taskStatus)) {
    return next(
      badRequest(
        `taskStatus is required and must be one of: ${VALID_TARGET_STATUSES.join(", ")}`,
      ),
    );
  }

  try {
    const task = await tasksService.updateTaskStatus(
      taskID,
      { taskStatus },
      { role: req.user.role, userID: req.user.userID },
    );
    return successResponse(res, `Task ${taskStatus.toLowerCase()} successfully`, task);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listTasks, getTask, createTask, updateTask, updateTaskStatus };
