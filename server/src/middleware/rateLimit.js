// rateLimiter(name) — a middleware that allows RATE_LIMITS[name].limit
// requests per window, then answers 429 TOO_MANY_REQUESTS in the standard
// envelope with details { reason: "rate_limited", retryAfterSeconds }.
// Keyed by the visitor's IP (clientIp below), except login (the email tried)
// and ai (the signed-in user — mount it after authenticate).
// RATE_LIMITS=off skips every limiter.
const { rateLimit } = require("express-rate-limit");
const { RATE_LIMITS } = require("../config/rateLimits");
const { errorResponse } = require("../utils/response");

// The visitor's IP behind Render. req.ip is no use there: it's one of Render's
// internal load balancers (10.x), a different one almost every request.
// Measured on the live API (2026-10-25):
// - through Vercel's /api rewrite, Vercel writes the visitor's IP into
//   x-vercel-forwarded-for (cf-connecting-ip is then Vercel's own address,
//   shared by every visitor);
// - straight to the API (the notification stream), Cloudflare in front of
//   Render writes it into cf-connecting-ip, replacing anything the caller sent.
// A direct caller could send a made-up x-vercel-forwarded-for to dodge the
// per-IP limits; login (per email) and ai (per user) don't depend on this.
// Locally neither header exists, so it falls back to req.ip.
const clientIp = (req) => {
  const vercel = req.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  return vercel || req.get("cf-connecting-ip")?.trim() || req.ip;
};

const KEY_GENERATORS = {
  login: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  ai: (req) => `user:${req.user?.userID ?? clientIp(req)}`,
};

const ipKey = (req) => `ip:${clientIp(req)}`;

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
    keyGenerator: KEY_GENERATORS[name] ?? ipKey,
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

module.exports = { rateLimiter, clientIp };
