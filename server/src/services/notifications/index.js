// The ONLY import for in-app notifications — nothing else requires
// messages.js (same pattern as services/email/ and services/ai/).
//
// notify() is called by the services AFTER their own write has committed,
// with a message from `messages`:
//   await notify(recipientIDs, messages.applicationApproved({ petName, shelterName }));
// It's awaited (one quick insert, so the rows exist by the time the response
// goes out) but never throws: the action it reports already happened, so a
// failure is logged and the request still succeeds — the same rule as
// queueEmail. Each stored row is then pushed to its recipient's open streams.
const prisma = require("../../config/prisma");
const messages = require("./messages");
const hub = require("./hub");
const inbox = require("./inbox");
const { openStream } = require("./stream");
const { toItem } = inbox;

// Column limits on Notification (schema.prisma). Text is built from names the
// app already caps, but a long pet + shelter name could still run over.
const LIMITS = { title: 120, body: 300, link: 200 };
const clip = (value, max) =>
  value && value.length > max ? `${value.slice(0, max - 1)}…` : value;

// Stores one notification per recipient. `userIDs` may contain nulls and
// repeats (e.g. an unassigned vet, a manager who is also on the shelter's
// staff list) — they're dropped. Returns the created rows ([] on failure or
// when there's no one to tell).
const notify = async (userIDs, { type, title, body, link = null }) => {
  const recipients = [...new Set(userIDs.filter((id) => Number.isInteger(id)))];
  if (recipients.length === 0) return [];
  let rows;
  try {
    rows = await prisma.notification.createManyAndReturn({
      data: recipients.map((userID) => ({
        userID,
        type,
        title: clip(title, LIMITS.title),
        body: clip(body, LIMITS.body),
        link: clip(link, LIMITS.link),
      })),
    });
  } catch (err) {
    console.error(`[notifications] couldn't store ${type} for users ${recipients.join(", ")}: ${err.message}`);
    return [];
  }
  // A push that fails costs nothing — the row is stored and the client
  // refetches on reconnect — so it must not undo the successful insert.
  try {
    for (const row of rows) hub.publish(row.userID, "notification", toItem(row));
  } catch (err) {
    console.error(`[notifications] couldn't push ${type}: ${err.message}`);
  }
  return rows;
};

// ——————————————— Recipients ———————————————
// Each returns user IDs to pass straight to notify(). Only Active accounts —
// a Pending, Deactivated or Closed one has no dashboard to see them on.

// Everyone on a shelter's staff, the manager included.
const shelterStaffIDs = async (shelterID) => {
  const staff = await prisma.staff.findMany({
    where: { shelterID, accountStatus: "Active" },
    select: { userID: true },
  });
  return staff.map((s) => s.userID);
};

// The shelter's manager, or null when it has none.
const shelterManagerID = async (shelterID) => {
  const shelter = await prisma.shelter.findUnique({
    where: { shelterID },
    select: { manager: { select: { userID: true, accountStatus: true } } },
  });
  return shelter?.manager?.accountStatus === "Active" ? shelter.manager.userID : null;
};

const activeAdminIDs = async () => {
  const admins = await prisma.admin.findMany({
    where: { accountStatus: "Active" },
    select: { userID: true },
  });
  return admins.map((a) => a.userID);
};

// The adopter holding the pet's Accepted application (at most one — a partial
// unique index), or null. The same rule that lets an adopter see a pet's vet
// appointments (adopter/appointments.service.js).
const acceptedAdopterForPet = async (petID) => {
  const application = await prisma.adoptionApplication.findFirst({
    where: { petID, applicationStatus: "Accepted" },
    select: { adopterID: true },
  });
  return application?.adopterID ?? null;
};

module.exports = {
  notify,
  messages,
  toItem,
  openStream,
  listNotifications: inbox.listNotifications,
  getUnreadCount: inbox.getUnreadCount,
  markNotification: inbox.markNotification,
  markAllRead: inbox.markAllRead,
  shelterStaffIDs,
  shelterManagerID,
  activeAdminIDs,
  acceptedAdopterForPet,
};
