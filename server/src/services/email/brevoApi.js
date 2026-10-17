// The ONLY file that talks to the email provider — Brevo's transactional email
// API over HTTPS. Not SMTP: Railway blocks outbound SMTP below its Pro plan,
// and an HTTPS API works everywhere. Uses global fetch (like services/ai/ and
// services/storage/) so no SDK dependency is needed. Moving to another HTTPS
// provider (Resend, Postmark, …) means rewriting this one file.

const { SEND_TIMEOUT_MS, DEFAULT_FROM_NAME } = require("../../config/email");

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

// Read on every call rather than at require time, so tests can switch email on
// and off by setting process.env.
const readConfig = () => ({
  apiKey: (process.env.EMAIL_API_KEY || "").trim(),
  // Must be a sender verified in the Brevo account, or Brevo rejects the send.
  fromEmail: (process.env.EMAIL_FROM || "").trim(),
  fromName: (process.env.EMAIL_FROM_NAME || "").trim() || DEFAULT_FROM_NAME,
});

// Email is optional — with the key or sender unset, emails go to the console
// instead (services/email/index.js).
const isEmailConfigured = () => {
  const { apiKey, fromEmail } = readConfig();
  return Boolean(apiKey && fromEmail);
};

const providerError = (message) => {
  const err = new Error(message);
  err.code = "INTERNAL_SERVER_ERROR";
  return err;
};

// Sends one email. Resolves once Brevo has accepted it; throws on a timeout,
// network failure or non-2xx reply.
const sendViaProvider = async ({ to, subject, text, html, timeoutMs = SEND_TIMEOUT_MS }) => {
  const { apiKey, fromEmail, fromName } = readConfig();

  let res;
  try {
    res = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (fetchErr) {
    if (fetchErr.name === "TimeoutError") {
      throw providerError(`Email provider timed out after ${timeoutMs} ms`);
    }
    throw providerError(`Email provider unreachable: ${fetchErr.message}`);
  }

  if (!res.ok) {
    // Keep only the provider's own message — never the request we sent.
    let detail = "";
    try {
      detail = (await res.json())?.message || "";
    } catch {
      // non-JSON error body
    }
    throw providerError(
      `Email provider returned ${res.status}${detail ? `: ${detail}` : ""}`,
    );
  }
};

module.exports = { isEmailConfigured, sendViaProvider };
