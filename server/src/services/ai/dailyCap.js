// The app-wide daily cap on AI provider calls (AI_DAILY_CALL_LIMIT in
// config/aiUsage.js). reserveDailyCall() counts one call or throws an AI error
// with reason DAILY_LIMIT, which every caller already treats like any other
// AI failure (rule-only matches, a 503 for the summary).
//
// The count lives in memory, like the rate limits: fine for the single Render
// instance. A restart (a deploy, or waking after 15 idle minutes) starts the
// day's count again — acceptable, since a burst of abuse keeps it awake.
const { AI_DAILY_CALL_LIMIT } = require("../../config/aiUsage");
const { AI_ERROR_REASONS } = require("./openAiCompatible");

const state = { day: null, count: 0 };

const utcDay = (now) => now.toISOString().slice(0, 10);

const reserveDailyCall = (now = new Date()) => {
  const day = utcDay(now);
  if (state.day !== day) {
    state.day = day;
    state.count = 0;
  }
  if (state.count >= AI_DAILY_CALL_LIMIT) {
    const err = new Error(`Daily AI limit of ${AI_DAILY_CALL_LIMIT} calls reached`);
    err.code = "INTERNAL_SERVER_ERROR";
    err.reason = AI_ERROR_REASONS.DAILY_LIMIT;
    throw err;
  }
  state.count += 1;
};

// For tests.
const resetDailyCap = () => {
  state.day = null;
  state.count = 0;
};

module.exports = { reserveDailyCall, resetDailyCap };
