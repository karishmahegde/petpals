// Every rate limit in one place — how many requests each limiter allows per
// window. Counts live in memory (middleware/rateLimit.js), which is fine for
// the single Render instance; scaling out would need a shared store.
// RATE_LIMITS=off in server/.env switches them all off (local Cypress and
// repeated integration runs sign up and log in far more than a person would).

const MINUTE_MS = 60 * 1000;

const RATE_LIMITS = Object.freeze({
  // Per email, wherever the tries come from — guessing one account's password
  // is capped even from many addresses, and nobody else is locked out. (The
  // trade-off: wrong passwords on purpose can lock that one account out for
  // the window.)
  login: { windowMs: 15 * MINUTE_MS, limit: 10 },
  register: { windowMs: 60 * MINUTE_MS, limit: 10 },
  // Requests that send an email (reset, verification, reactivation, email
  // change). Each user also has the 60s resend cooldown (config/email.js) —
  // this one stops a single IP spraying links at many addresses.
  emailLinkRequest: { windowMs: 15 * MINUTE_MS, limit: 5 },
  // Redeeming an emailed token, and changing a password with the current one.
  tokenRedeem: { windowMs: 15 * MINUTE_MS, limit: 20 },
  // Per user: the AI matcher and passport summary each can call the provider,
  // whose free tier has its own quota.
  ai: { windowMs: 60 * MINUTE_MS, limit: 30 },
  // Backstop for the whole API, per IP — far above what a dashboard sends.
  api: { windowMs: 1 * MINUTE_MS, limit: 300 },
});

module.exports = { RATE_LIMITS };
