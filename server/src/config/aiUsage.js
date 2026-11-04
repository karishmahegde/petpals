// The app-wide AI budget (services/ai/dailyCap.js). Per-user limits live in
// config/rateLimits.js; this one caps every user combined, so many accounts
// can't use up the provider's free quota between them.

// Provider calls allowed per UTC day, all features together (matcher +
// passport summary). Past it, the matcher falls back to rule scores and the
// summary answers "try again shortly" until the next UTC day. Most requests
// never call the provider — matches and summaries are cached — so a normal
// day uses a handful.
const AI_DAILY_CALL_LIMIT = 200;

module.exports = { AI_DAILY_CALL_LIMIT };
