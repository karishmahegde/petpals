const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { TOKEN_TTL_MS, RESEND_COOLDOWN_MS } = require("../../config/email");

// Single-use tokens for the emailed links (verify email, reset password,
// reactivate a Closed account, confirm an email change). The raw token only
// ever exists in the link; the AccountToken row stores its SHA-256 hex, so a
// leaked table can't be turned back into working links.

const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const tokenError = (message, reason) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  // token_invalid | token_expired | token_used — lets the client show
  // "request a new link" vs "already done".
  err.details = { reason };
  return err;
};

// Issues a new token and returns { token, expiresAt } — the raw token goes in
// the emailed link, never in a response. Inside the resend cooldown → 429.
// Otherwise the user's earlier unused tokens of this purpose are deleted (only
// the newest link works) along with any of their expired ones. `newEmail` is
// for EmailChange only. Pass `db` to run inside the caller's $transaction.
const issueToken = async (userID, purpose, { newEmail = null } = {}, db = prisma) => {
  const ttl = TOKEN_TTL_MS[purpose];
  if (!ttl) throw new Error(`Unknown account token purpose: ${purpose}`);

  const now = new Date();
  const recent = await db.accountToken.findFirst({
    where: {
      userID,
      purpose,
      createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const waitMs = recent.createdAt.getTime() + RESEND_COOLDOWN_MS - now.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    const err = new Error(
      `An email was just sent — please wait ${retryAfterSeconds} seconds before asking for another`,
    );
    err.code = "TOO_MANY_REQUESTS";
    err.details = { retryAfterSeconds };
    throw err;
  }

  await db.accountToken.deleteMany({
    where: {
      userID,
      OR: [{ purpose, usedAt: null }, { expiresAt: { lt: now } }],
    },
  });

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ttl);
  await db.accountToken.create({
    data: { userID, purpose, tokenHash: hashToken(token), newEmail, expiresAt },
  });

  return { token, expiresAt };
};

// Checks a token from a link and marks it used. Returns { userID, newEmail }.
// Throws 400 BAD_REQUEST with details.reason token_invalid (unknown, or for a
// different purpose), token_expired or token_used. Run it in the same
// $transaction as the change the link makes (pass `db`), so a failed change
// leaves the link usable. The conditional update makes it single-use even when
// two requests race.
const consumeToken = async (rawToken, purpose, db = prisma) => {
  if (typeof rawToken !== "string" || rawToken.trim() === "") {
    throw tokenError("This link is invalid", "token_invalid");
  }

  const row = await db.accountToken.findUnique({
    where: { tokenHash: hashToken(rawToken.trim()) },
    select: { tokenID: true, userID: true, purpose: true, newEmail: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.purpose !== purpose) {
    throw tokenError("This link is invalid", "token_invalid");
  }
  if (row.usedAt) {
    throw tokenError("This link has already been used", "token_used");
  }
  if (row.expiresAt <= new Date()) {
    throw tokenError("This link has expired — please request a new one", "token_expired");
  }

  const { count } = await db.accountToken.updateMany({
    where: { tokenID: row.tokenID, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) {
    throw tokenError("This link has already been used", "token_used");
  }

  return { userID: row.userID, newEmail: row.newEmail };
};

module.exports = { issueToken, consumeToken, hashToken };
