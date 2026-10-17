// Every email knob in one place — link lifetimes, the resend cooldown and the
// provider timeout. Purposes match the AccountTokenPurpose enum.

const HOUR_MS = 60 * 60 * 1000;

// How long an emailed link works before it has to be requested again.
// A reset link is the most sensitive (it sets a new password without the old
// one), so it gets the shortest life.
const TOKEN_TTL_MS = Object.freeze({
  EmailVerification: 24 * HOUR_MS,
  PasswordReset: 1 * HOUR_MS,
  Reactivation: 24 * HOUR_MS,
  EmailChange: 24 * HOUR_MS,
});

// A new link of the same purpose can't be requested again within this window
// (429) — stops someone hammering "Resend" into a stranger's inbox.
const RESEND_COOLDOWN_MS = 60 * 1000;

// Gives up on the provider after this. Emails are sent after the response
// (queueEmail), so a slow provider never holds up a request — this just stops
// a hung connection lingering.
const SEND_TIMEOUT_MS = 10000;

// Shown as the sender name when EMAIL_FROM_NAME isn't set.
const DEFAULT_FROM_NAME = "PetPals";

module.exports = { TOKEN_TTL_MS, RESEND_COOLDOWN_MS, SEND_TIMEOUT_MS, DEFAULT_FROM_NAME };
