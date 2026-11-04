// The shared demo logins printed in the README (seeded by seed.js). Anyone on
// the internet can sign in with them, so the account-level actions that would
// lock everyone else out are refused for these addresses
// (services/auth/demoAccounts.js): changing the password or email, closing or
// deleting the account, and emailing a password-reset link. No email is ever
// sent to these addresses either (services/email). Everything else works as
// for any account. Lower case — compared case-insensitively.

const DEMO_ACCOUNT_EMAILS = Object.freeze([
  "adopter@petpals.com",
  "volunteer@petpals.com",
  "donor@petpals.com",
]);

module.exports = { DEMO_ACCOUNT_EMAILS };
