const prisma = require("../../config/prisma");
const { queueEmail, templates } = require("../email");
const { issueToken, consumeToken } = require("./accountTokens.service");
const { getUserContact, ROLE_FIELDS } = require("./userContact");

// Self-service reactivation of a Closed account (one its owner closed). An
// account deactivated by an admin/staff member, declined at sign-up or
// banned can't be reopened this way.
//
// Where it lands: Adopter and Donor go straight back to Active; Staff,
// Veterinarian, Volunteer and Admin go back to Pending and are re-approved
// the usual way (their onboarding and government ID are already done).
const ACTIVE_ON_REACTIVATION = new Set(["Adopter", "Donor"]);

const reactivatedStatus = (role) => (ACTIVE_ON_REACTIVATION.has(role) ? "Active" : "Pending");

// ——————————————— POST /auth/reactivation ———————————————
// Same answer whatever the email (no account enumeration); a link only goes
// to a Closed account, at most once a minute (a quicker repeat sends nothing).
const requestReactivation = async (email) => {
  if (typeof email !== "string" || email.trim() === "") {
    const err = new Error("email is required");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const user = await prisma.users.findUnique({
    where: { userEmail: email.trim() },
    select: { userID: true },
  });
  if (!user) return;

  const contact = await getUserContact(user.userID);
  if (contact?.accountStatus !== "Closed") return;

  let token;
  try {
    ({ token } = await issueToken(contact.userID, "Reactivation"));
  } catch (err) {
    if (err.code === "TOO_MANY_REQUESTS") return;
    throw err;
  }
  queueEmail({
    to: contact.email,
    ...templates.reactivateAccount({
      name: contact.name,
      url: templates.clientLink("/reactivate", { token }),
    }),
  });
};

// ——————————————— PATCH /auth/reactivation ———————————————
// Returns { role, accountStatus } so the page can say "log in" or "waiting
// for approval". The account must still be Closed when the link is used
// (409 otherwise — e.g. an admin changed it meanwhile); the transaction then
// rolls back and the link stays unused. Opening the link proves the owner
// has the address, so it's verified too.
const reactivate = async (rawToken) =>
  prisma.$transaction(async (tx) => {
    const { userID } = await consumeToken(rawToken, "Reactivation", tx);
    const contact = await getUserContact(userID, tx);
    if (contact?.accountStatus !== "Closed") {
      const err = new Error("This account isn't closed, so it can't be reactivated");
      err.code = "CONFLICT";
      err.details = { reason: "not_closed" };
      throw err;
    }

    const accountStatus = reactivatedStatus(contact.role);
    await tx[ROLE_FIELDS[contact.role].relation].update({
      where: { userID },
      data: {
        accountStatus,
        // Admin keeps a last-change audit trail — the owner made this one.
        ...(contact.role === "Admin"
          ? { statusChangedByID: userID, statusChangedAt: new Date() }
          : {}),
      },
    });
    await tx.users.update({ where: { userID }, data: { emailVerified: true } });

    return { role: contact.role, accountStatus };
  });

module.exports = { requestReactivation, reactivate, reactivatedStatus };
