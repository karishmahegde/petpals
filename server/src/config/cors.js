// Origins the browser may call this API from with credentials (app.js's cors()).
//
// In production the client's REST calls never need this: Vercel rewrites
// /api/* to Render, so they're same-origin. Only the notification stream
// connects to Render directly (VITE_STREAM_URL — a rewrite may buffer it),
// so the Vercel site must be listed here.
//
// CLIENT_URL is the site's one origin (Stripe return URLs and emailed links
// are built from it), so it's the default. CORS_ORIGINS, a comma-separated
// list, replaces it when more origins need the stream (another domain, a
// preview deployment). Trailing slashes are dropped: browsers send the Origin
// header without one, and cors() compares strings exactly.
const DEFAULT_ORIGIN = "http://localhost:3000";

const parseCorsOrigins = (env = process.env) => {
  const raw = env.CORS_ORIGINS || env.CLIENT_URL || DEFAULT_ORIGIN;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return origins.length > 0 ? origins : [DEFAULT_ORIGIN];
};

module.exports = { parseCorsOrigins };
