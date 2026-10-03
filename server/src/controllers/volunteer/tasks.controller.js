const tasksService = require("../../services/volunteer/tasks.service");
const { successResponse, successListResponse } = require("../../utils/response");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const VALID_STATUS_FILTERS = ["In_progress", "Completed", "Cancelled"];

// ——————————————— GET /volunteers/me/tasks ———————————————
// taskStatus and upcoming are closed values, validated strictly (400);
// upcoming omitted means every task.
const listMyTasks = async (req, res, next) => {
  const { taskStatus, upcoming: upcomingRaw, page: pageRaw, limit: limitRaw } = req.query;

  if (taskStatus !== undefined && !VALID_STATUS_FILTERS.includes(taskStatus)) {
    return next(
      badRequest(`taskStatus must be one of: ${VALID_STATUS_FILTERS.join(", ")}`),
    );
  }

  if (upcomingRaw !== undefined && upcomingRaw !== "true" && upcomingRaw !== "false") {
    return next(badRequest("upcoming must be 'true' or 'false'"));
  }
  const upcoming = upcomingRaw === undefined ? undefined : upcomingRaw === "true";

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

  try {
    const result = await tasksService.listMyTasks(req.user.userID, {
      taskStatus,
      upcoming,
      page,
      limit,
    });
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

// ——————————————— PATCH /volunteers/me/tasks/:id/status ———————————————
// Body { taskStatus: "Completed" } — the only transition a volunteer makes.
const completeMyTask = async (req, res, next) => {
  const taskID = Number(req.params.id);
  if (!Number.isInteger(taskID) || taskID < 1) {
    return next(badRequest("id must be a positive integer"));
  }
  if (req.body?.taskStatus !== "Completed") {
    return next(badRequest("taskStatus must be 'Completed'"));
  }

  try {
    const task = await tasksService.completeMyTask(req.user.userID, taskID);
    return successResponse(res, "Task completed successfully", task);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyTasks, completeMyTask };
