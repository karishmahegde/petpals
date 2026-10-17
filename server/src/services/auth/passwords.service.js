const bcrypt = require("bcrypt");
const prisma = require("../../config/prisma");
const { queueEmail, templates } = require("../email");
const { issueToken, consumeToken } = require("./accountTokens.service");
const { getUserContact } = require("./userContact");
const { assertStrongPassword } = require("../../utils/password");

// Forgot/reset password (no session) and change password (signed in).
// Every successful change emails a "your password was changed" notice.

// Accounts a reset link is never sent to — they can't log in whatever the
// password is, so a link would only confuse.
const NO_RESET_STATUSES = new Set(["Banned", "Declined"]);

const notifyPasswordChanged = (contact) => {
  queueEmail({ to: contact.email, ...templates.passwordChanged({ name: contact.name }) });
};

// ——————————————— POST /auth/password-reset ———————————————
// Always resolves the same way, whether or not the email has an account (no
// account enumeration). The cooldown 429 is swallowed for the same reason —
// a second request inside it just doesn't send another email.
const requestPasswordReset = async (email) => {
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
  if (!contact || NO_RESET_STATUSES.has(contact.accountStatus)) return;

  let token;
  try {
    ({ token } = await issueToken(contact.userID, "PasswordReset"));
  } catch (err) {
    if (err.code === "TOO_MANY_REQUESTS") return;
    throw err;
  }
  queueEmail({
    to: contact.email,
    ...templates.passwordReset({
      name: contact.name,
      url: templates.clientLink("/reset-password", { token }),
    }),
  });
};

// ——————————————— PATCH /auth/password-reset ———————————————
// Sets the new password and clears the stored refresh token, signing out
// every session — the person resetting may not be the one signed in. Opening
// the emailed link proves they own the address, so it's verified too. The
// token is consumed in the same transaction, so a failed write leaves the
// link usable.
const resetPassword = async (rawToken, password) => {
  assertStrongPassword(password);
  const hashedPassword = await bcrypt.hash(password, 10);

  const contact = await prisma.$transaction(async (tx) => {
    const { userID } = await consumeToken(rawToken, "PasswordReset", tx);
    await tx.users.update({
      where: { userID },
      data: { userPassword: hashedPassword, refreshToken: null, emailVerified: true },
    });
    return getUserContact(userID, tx);
  });

  if (contact) notifyPasswordChanged(contact);
};

// Throws 401 if `password` isn't the user's current one. 401 is safe on
// /auth/ calls — the client's axios interceptor doesn't sign out on those.
// Shared with the email change, which also asks for the current password.
const assertCurrentPassword = async (userID, password) => {
  const user = await prisma.users.findUnique({
    where: { userID },
    select: { userPassword: true },
  });
  const matches =
    typeof password === "string" && user && (await bcrypt.compare(password, user.userPassword));
  if (!matches) {
    const err = new Error("Current password is incorrect");
    err.code = "UNAUTHORIZED";
    err.details = { reason: "wrong_password" };
    throw err;
  }
};

// ——————————————— PATCH /auth/password ———————————————
// The caller (controller) then rotates the refresh token so this session
// stays signed in while any other one is signed out.
const changePassword = async (userID, currentPassword, newPassword) => {
  assertStrongPassword(newPassword, "newPassword");
  await assertCurrentPassword(userID, currentPassword);
  // currentPassword was just confirmed, so comparing the two is enough.
  if (newPassword === currentPassword) {
    const err = new Error("The new password must be different from the current one");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  await prisma.users.update({
    where: { userID },
    data: { userPassword: await bcrypt.hash(newPassword, 10) },
  });

  const contact = await getUserContact(userID);
  if (contact) notifyPasswordChanged(contact);
};

module.exports = {
  requestPasswordReset,
  resetPassword,
  changePassword,
  assertCurrentPassword,
};
