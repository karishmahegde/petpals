const { queueEmail, templates } = require("../email");
const { getUserContact } = require("./userContact");

// Emails about the account itself: closing/deleting it (the owner), and
// status changes someone else made — approve, decline, deactivate, ban,
// reactivate. Called by the services after their write has committed.
// Never throws: the change already happened, so a failed lookup or send is
// logged and the request still succeeds.

// Workers log in through the staff portal — same split as the client's
// loginPathFor (logic/route/resolveDestination.ts).
const WORKER_ROLES = new Set(["Admin", "Staff", "Veterinarian"]);
const loginUrlFor = (role) =>
  templates.clientLink(WORKER_ROLES.has(role) ? "/staff-portal/login" : "/login");

const logFailure = (what, userID, err) => {
  console.error(`[email] couldn't send the ${what} notice for user ${userID}: ${err.message}`);
};

// Read the contact BEFORE a delete removes the rows; null if that fails.
const lookupContact = async (userID) => {
  try {
    return await getUserContact(userID);
  } catch (err) {
    logFailure("account", userID, err);
    return null;
  }
};

// After DELETE /<role>/me: `mode` is "deactivate" (→ Closed) or "delete".
const accountClosed = (contact, mode) => {
  if (!contact) return;
  queueEmail({
    to: contact.email,
    ...(mode === "delete"
      ? templates.accountDeleted({ name: contact.name })
      : templates.accountClosed({ name: contact.name, loginUrl: loginUrlFor(contact.role) })),
  });
};

// Which notice (if any) a from → to change made by someone else gets.
const statusTemplate = (from, to) => {
  if (from === "Pending" && to === "Active") return "accountApproved";
  if (from === "Pending" && to === "Declined") return "accountDeclined";
  if (to === "Deactivated") return "accountDeactivated";
  if (to === "Banned") return "accountBanned";
  if (to === "Active" && (from === "Deactivated" || from === "Banned")) return "accountRestored";
  return null;
};

// After an admin/staff status change. Looks the contact up itself (the
// account still exists).
const statusChanged = async (userID, from, to) => {
  const template = statusTemplate(from, to);
  if (!template) return;
  try {
    const contact = await getUserContact(userID);
    if (!contact) return;
    queueEmail({
      to: contact.email,
      ...templates[template]({ name: contact.name, loginUrl: loginUrlFor(contact.role) }),
    });
  } catch (err) {
    logFailure("status change", userID, err);
  }
};

module.exports = { lookupContact, accountClosed, statusChanged, statusTemplate, loginUrlFor };
