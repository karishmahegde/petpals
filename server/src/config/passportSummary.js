// The health-passport AI summary (services/staff/healthPassportSummary.service.js).
// Every knob lives here so tuning never means touching the service.

// The one AI call per regeneration — same free-tier budget as the matcher
// (config/matchScoring.js): ~3K prompt at the caps below, the rest for
// low-effort reasoning + the reply.
const AI_SUMMARY_CALL = {
  reasoningEffort: "low",
  maxTokens: 1500,
  temperature: 0.2,
};

// What's sent, newest first — a long-stay pet's oldest notes are left out
// rather than blowing the token budget. Doses are short, so all of them go.
const MAX_HEALTH_RECORDS = 20;
const MAX_TRANSFERS = 10;

// Reply limits. SUMMARY_MAX_LENGTH matches PetHealthSummary.summary's
// VARCHAR(1500); longer replies are cut to fit.
const SUMMARY_MAX_LENGTH = 1500;
const MAX_POINTS = 5;
const POINT_MAX_LENGTH = 200;

module.exports = {
  AI_SUMMARY_CALL,
  MAX_HEALTH_RECORDS,
  MAX_TRANSFERS,
  SUMMARY_MAX_LENGTH,
  MAX_POINTS,
  POINT_MAX_LENGTH,
};
