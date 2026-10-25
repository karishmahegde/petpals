// rateLimiter(name) — a middleware that allows RATE_LIMITS[name].limit
// requests per window, then answers 429 TOO_MANY_REQUESTS in the standard
// envelope with details { reason: "rate_limited", retryAfterSeconds }.
// Keyed by IP (trust proxy is set in app.js, so req.ip is the client's), except
// login (the email tried) and ai (the signed-in user — mount it after
// authenticate).
// RATE_LIMITS=off skips every limiter.
const { rateLimit } = require("express-rate-limit");
const { RATE_LIMITS } = require("../config/rateLimits");
const { errorResponse } = require("../utils/response");

const KEY_GENERATORS = {
  login: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  ai: (req) => `user:${req.user?.userID ?? req.ip}`,
};

const minutesText = (seconds) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
};

const rateLimiter = (name) => {
  const config = RATE_LIMITS[name];
  if (!config) throw new Error(`Unknown rate limit "${name}"`);

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.RATE_LIMITS === "off",
    ...(KEY_GENERATORS[name] && { keyGenerator: KEY_GENERATORS[name] }),
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(config.windowMs / 1000);
      res.set("Retry-After", String(retryAfterSeconds));
      return errorResponse(
        res,
        `Too many attempts — please try again in ${minutesText(retryAfterSeconds)}.`,
        "TOO_MANY_REQUESTS",
        { reason: "rate_limited", retryAfterSeconds },
        429,
      );
    },
  });
};

module.exports = { rateLimiter };
