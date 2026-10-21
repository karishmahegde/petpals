const notifications = require("../../services/notifications");
const { successResponse } = require("../../utils/response");
const { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } = require("../../config/notifications");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

// ——————————————— GET /notifications ———————————————
// unread is a closed value, validated strictly (400); omitted or "false"
// means every notification.
const listNotifications = async (req, res, next) => {
  const { unread: unreadRaw, page: pageRaw, limit: limitRaw } = req.query;

  if (unreadRaw !== undefined && unreadRaw !== "true" && unreadRaw !== "false") {
    return next(badRequest("unread must be 'true' or 'false'"));
  }

  let page = 1;
  if (pageRaw !== undefined) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return next(badRequest("page must be an integer >= 1"));
    }
  }

  let limit = DEFAULT_PAGE_LIMIT;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
      return next(badRequest(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`));
    }
  }

  try {
    const result = await notifications.listNotifications(req.user.userID, {
      unread: unreadRaw === "true",
      page,
      limit,
    });
    // The list envelope plus unreadCount, so the bell's badge and the list
    // come from one request.
    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /notifications/unread-count ———————————————
const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notifications.getUnreadCount(req.user.userID);
    return successResponse(res, "Unread count retrieved successfully", result);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /notifications/:id ———————————————
// Body { read: true | false }.
const markNotification = async (req, res, next) => {
  const notificationID = Number(req.params.id);
  if (!Number.isInteger(notificationID) || notificationID < 1) {
    return next(badRequest("id must be a positive integer"));
  }
  if (typeof req.body?.read !== "boolean") {
    return next(badRequest("read must be true or false"));
  }

  try {
    const result = await notifications.markNotification(
      req.user.userID,
      notificationID,
      req.body.read,
    );
    return successResponse(
      res,
      `Notification marked ${req.body.read ? "read" : "unread"}`,
      result,
    );
  } catch (err) {
    return next(err);
  }
};

// ——————————————— PATCH /notifications ———————————————
// Body { read: true } — marking everything unread isn't offered.
const markAllRead = async (req, res, next) => {
  if (req.body?.read !== true) {
    return next(badRequest("read must be true"));
  }

  try {
    const result = await notifications.markAllRead(req.user.userID);
    return successResponse(res, "All notifications marked read", result);
  } catch (err) {
    return next(err);
  }
};

// ——————————————— GET /notifications/stream ———————————————
// Held open as Server-Sent Events until the client leaves or the access
// token expires. Once the headers are out an error can't become a JSON
// envelope, so openStream handles its own.
const streamNotifications = (req, res) =>
  notifications.openStream(req.user.userID, req.tokenExpiresAt, req, res);

module.exports = {
  listNotifications,
  getUnreadCount,
  markNotification,
  markAllRead,
  streamNotifications,
};
