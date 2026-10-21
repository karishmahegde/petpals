// Every in-app notification knob in one place.

const DAY_MS = 24 * 60 * 60 * 1000;

// Read notifications older than this are deleted the next time their owner
// opens the list (no cron — same lazy approach as AccountToken expiry).
// Unread ones are never deleted, however old.
const READ_RETENTION_MS = 90 * DAY_MS;

// GET /notifications page size: the default, and the most one page may ask for.
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

// GET /notifications/stream sends a comment line this often so proxies and
// load balancers don't close a connection that's quiet between events.
const STREAM_HEARTBEAT_MS = 25 * 1000;

module.exports = {
  READ_RETENTION_MS,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  STREAM_HEARTBEAT_MS,
};
