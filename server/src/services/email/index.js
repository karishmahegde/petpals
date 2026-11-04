// The ONLY import for email — nothing else requires brevoApi.js or
// templates.js. Moving to another provider means rewriting brevoApi.js (same
// pattern as services/ai/, services/geocoding/ and services/storage/).
const { isEmailConfigured, sendViaProvider } = require("./brevoApi");
const templates = require("./templates");
const { isDemoAccount } = require("../auth/demoAccounts");

// Sends one email ({ to, subject, text, html } — usually a template's output
// plus `to`). Email is optional: with EMAIL_API_KEY/EMAIL_FROM unset it prints
// the email to the server console instead (links included), so every flow
// still works locally. Tests stay quiet — they assert on a mocked module.
//
// Never sent to the shared demo logins (config/demoAccounts.js): their seeded
// @petpals.com addresses aren't our inboxes, so a visitor's actions on them
// mustn't email whoever owns that domain. Logged instead, like the console
// fallback.
const sendEmail = async (message) => {
  if (isDemoAccount(message.to)) {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email] not sent — ${message.to} is a shared demo login (subject: ${message.subject})`);
    }
    return { delivered: false };
  }
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "test") {
      console.info(
        `[email] not configured — would send to ${message.to}\n` +
          `Subject: ${message.subject}\n\n${message.text}\n`,
      );
    }
    return { delivered: false };
  }
  await sendViaProvider(message);
  return { delivered: true };
};

// Fire-and-forget: call after the DB write has committed, never await it. An
// email failure is logged, never thrown — the request it belongs to has
// already succeeded, and a slow provider mustn't hold up the response.
const queueEmail = (message) => {
  Promise.resolve()
    .then(() => sendEmail(message))
    .catch((err) => {
      console.error(`[email] failed to send "${message.subject}" to ${message.to}: ${err.message}`);
    });
};

module.exports = { isEmailConfigured, sendEmail, queueEmail, templates };
