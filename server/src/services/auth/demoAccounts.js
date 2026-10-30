const { DEMO_ACCOUNT_EMAILS } = require("../../config/demoAccounts");

// Guards for the shared demo logins (config/demoAccounts.js). Callers pass the
// contact they already looked up, so the guard adds no query.

const DEMO_EMAILS = new Set(DEMO_ACCOUNT_EMAILS);

const isDemoAccount = (email) =>
  typeof email === "string" && DEMO_EMAILS.has(email.trim().toLowerCase());

// 409, not 403 — the client's axios interceptor sends every 403 to /forbidden.
const assertNotDemoAccount = (contact) => {
  if (!isDemoAccount(contact?.email)) return;
  const err = new Error(
    "This is a shared demo account, so its password, email and account can't be changed. Sign up for your own account to try that.",
  );
  err.code = "CONFLICT";
  err.details = { reason: "demo_account" };
  throw err;
};

module.exports = { isDemoAccount, assertNotDemoAccount };
