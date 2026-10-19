// A user's own notifications — the REST side (GET/PATCH /notifications).
// Only index.js requires this file. Every query is scoped to the caller's
// userID, so another user's notification answers exactly like a missing one.
const prisma = require("../../config/prisma");
const hub = require("./hub");
const { READ_RETENTION_MS } = require("../../config/notifications");

// The row minus its owner — what the client gets, on the stream and here.
const toItem = ({ userID, ...item }) => item;

const notFound = (notificationID) => {
  const err = new Error(`No notification exists with ID ${notificationID}`);
  err.code = "NOT_FOUND";
  return err;
};

const countUnread = (userID) =>
  prisma.notification.count({ where: { userID, readAt: null } });

// Tells the user's other open tabs the new count, so every bell agrees after
// a mark-read in one of them.
const pushUnreadCount = (userID, unreadCount) => {
  try {
    hub.publish(userID, "unread-count", { unreadCount });
  } catch (err) {
    console.error(`[notifications] couldn't push unread-count to user ${userID}: ${err.message}`);
  }
};

// ——————————————— GET /notifications ———————————————
// Newest first. unread: true → unread only; otherwise everything.
// unreadCount is always the user's total, whatever the filter or page.
const listNotifications = async (userID, { unread, page, limit }) => {
  await prisma.notification.deleteMany({
    where: { userID, readAt: { lt: new Date(Date.now() - READ_RETENTION_MS) } },
  });

  const where = { userID, ...(unread ? { readAt: null } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { notificationID: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    countUnread(userID),
  ]);

  return {
    data: rows.map(toItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    unreadCount,
  };
};

// ——————————————— GET /notifications/unread-count ———————————————
const getUnreadCount = async (userID) => ({ unreadCount: await countUnread(userID) });

// ——————————————— PATCH /notifications/:id ———————————————
// read: true keeps the first readAt if it's already read (marking twice
// doesn't move it); read: false clears it.
const markNotification = async (userID, notificationID, read) => {
  const existing = await prisma.notification.findFirst({
    where: { notificationID, userID },
    select: { readAt: true },
  });
  if (!existing) {
    throw notFound(notificationID);
  }

  const readAt = read ? existing.readAt ?? new Date() : null;
  const [row, unreadCount] = await prisma.$transaction([
    prisma.notification.update({ where: { notificationID }, data: { readAt } }),
    countUnread(userID),
  ]);

  pushUnreadCount(userID, unreadCount);
  return { notification: toItem(row), unreadCount };
};

// ——————————————— PATCH /notifications ———————————————
const markAllRead = async (userID) => {
  const { count } = await prisma.notification.updateMany({
    where: { userID, readAt: null },
    data: { readAt: new Date() },
  });

  pushUnreadCount(userID, 0);
  return { updated: count, unreadCount: 0 };
};

module.exports = {
  toItem,
  countUnread,
  listNotifications,
  getUnreadCount,
  markNotification,
  markAllRead,
};
