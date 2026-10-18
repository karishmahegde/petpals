const prisma = require("../../config/prisma");
const { queueEmail, templates } = require("../email");
const { issueToken, consumeToken } = require("./accountTokens.service");
const { getUserContact } = require("./userContact");
const { assertCurrentPassword } = require("./passwords.service");
const { isUniqueViolation } = require("../../utils/prismaErrors");

// Changing the login email. Two steps so a typo can't lock anyone out: the
// request (signed in, current password) emails a link to the NEW address,
// and only opening it makes the change. The OLD address hears about both.

// Same pattern the register/login forms use; 45 = Users.userEmail VARCHAR(45).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 45;

const emailTaken = () => {
  const err = new Error("That email address is already used by another account");
  err.code = "CONFLICT";
  err.details = { reason: "email_taken" };
  return err;
};

// ——————————————— POST /auth/email-change ———————————————
const requestEmailChange = async (userID, newEmailRaw, currentPassword) => {
  const newEmail = typeof newEmailRaw === "string" ? newEmailRaw.trim() : "";
  if (!EMAIL_RE.test(newEmail) || newEmail.length > EMAIL_MAX_LENGTH) {
    const err = new Error(`newEmail must be a valid email address of at most ${EMAIL_MAX_LENGTH} characters`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const contact = await getUserContact(userID);
  if (!contact) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (newEmail.toLowerCase() === contact.email.toLowerCase()) {
    const err = new Error("That's already your email address");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  await assertCurrentPassword(userID, currentPassword);

  const taken = await prisma.users.findUnique({
    where: { userEmail: newEmail },
    select: { userID: true },
  });
  if (taken) throw emailTaken();

  const { token } = await issueToken(userID, "EmailChange", { newEmail });
  queueEmail({
    to: newEmail,
    ...templates.confirmEmailChange({
      name: contact.name,
      newEmail,
      url: templates.clientLink("/confirm-email-change", { token }),
    }),
  });
  queueEmail({
    to: contact.email,
    ...templates.emailChangeRequested({ name: contact.name, newEmail }),
  });
};

// ——————————————— PATCH /auth/email-change ———————————————
// No session needed (the link may be opened anywhere). Re-checks that the
// address is still free — someone may have registered it since the request —
// and maps a race on the unique index to the same 409. Returns { userEmail }.
const confirmEmailChange = async (rawToken) => {
  let previous;
  let newEmail;
  try {
    ({ previous, newEmail } = await prisma.$transaction(async (tx) => {
      const consumed = await consumeToken(rawToken, "EmailChange", tx);
      const contact = await getUserContact(consumed.userID, tx);
      const taken = await tx.users.findUnique({
        where: { userEmail: consumed.newEmail },
        select: { userID: true },
      });
      if (taken) throw emailTaken();

      await tx.users.update({
        where: { userID: consumed.userID },
        data: { userEmail: consumed.newEmail, emailVerified: true },
      });
      return { previous: contact, newEmail: consumed.newEmail };
    }));
  } catch (err) {
    if (isUniqueViolation(err)) throw emailTaken();
    throw err;
  }

  if (previous) {
    queueEmail({
      to: previous.email,
      ...templates.emailChanged({ name: previous.name, newEmail }),
    });
  }
  return { userEmail: newEmail };
};

module.exports = { requestEmailChange, confirmEmailChange };
