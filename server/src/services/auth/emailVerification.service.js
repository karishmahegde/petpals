const prisma = require("../../config/prisma");
const { queueEmail, templates } = require("../email");
const { issueToken, consumeToken } = require("./accountTokens.service");
const { getUserContact } = require("./userContact");

// Email verification. A new account starts unverified and is sent a link at
// registration; the link (or a resend) sets Users.emailVerified. Soft gate:
// only applying to adopt and donating need a verified email
// (assertEmailVerified) — everything else works without one.

const conflict = (message, reason) => {
  const err = new Error(message);
  err.code = "CONFLICT";
  err.details = { reason };
  return err;
};

// Issues a fresh link and queues the email. `contact` is { userID, email,
// name }. Throws 429 inside the resend cooldown (accountTokens.service.js).
const sendVerificationEmail = async (contact) => {
  const { token } = await issueToken(contact.userID, "EmailVerification");
  queueEmail({
    to: contact.email,
    ...templates.verifyEmail({
      name: contact.name,
      url: templates.clientLink("/verify-email", { token }),
    }),
  });
};

// ——————————————— POST /auth/email-verification ———————————————
// Resend for the signed-in user. Already verified → 409.
const requestVerification = async (userID) => {
  const contact = await getUserContact(userID);
  if (!contact) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (contact.emailVerified) {
    throw conflict("Your email address is already verified", "already_verified");
  }
  await sendVerificationEmail(contact);
};

// ——————————————— PATCH /auth/email-verification ———————————————
// No session needed — the link may be opened on another device. The token
// is consumed in the same transaction as the update, so a failed write
// leaves the link usable.
const verifyEmail = async (rawToken) =>
  prisma.$transaction(async (tx) => {
    const { userID } = await consumeToken(rawToken, "EmailVerification", tx);
    await tx.users.update({ where: { userID }, data: { emailVerified: true } });
    return { emailVerified: true };
  });

// The soft gate. 409, not 403 — the client's axios interceptor sends every
// 403 to /forbidden. `action` finishes the sentence ("applying to adopt").
const assertEmailVerified = async (userID, action) => {
  const user = await prisma.users.findUnique({
    where: { userID },
    select: { emailVerified: true },
  });
  if (user && !user.emailVerified) {
    throw conflict(
      `Please verify your email address before ${action}`,
      "email_unverified",
    );
  }
};

module.exports = {
  sendVerificationEmail,
  requestVerification,
  verifyEmail,
  assertEmailVerified,
};
