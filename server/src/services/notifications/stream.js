// GET /notifications/stream — one user's live Server-Sent Events stream.
// Only index.js requires this file.
//
// Events, each `event: <name>` + one JSON `data:` line:
//   unread-count   { unreadCount }  on connect, and after a mark-read in any tab
//   notification   <item>           a new notification (from notify())
//   token-expired  {}               just before the stream ends at the access
//                                   token's expiry — refresh, then reconnect
// plus a `: heartbeat` comment every STREAM_HEARTBEAT_MS.
//
// The stream is a nudge, not the record: the client refetches on every
// reconnect, so anything sent while it was disconnected is still picked up.
const hub = require("./hub");
const { countUnread } = require("./inbox");
const { STREAM_HEARTBEAT_MS } = require("../../config/notifications");

const openStream = async (userID, tokenExpiresAt, req, res) => {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Stops nginx-style proxies holding events back in a buffer.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  // Subscribed before the count is read, so a notification landing in
  // between still arrives (the client may then see it counted twice for a
  // moment; the next unread-count corrects it).
  const unsubscribe = hub.subscribe(userID, res);

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), STREAM_HEARTBEAT_MS);

  // A token is only checked when the stream opens, so the stream can't
  // outlive it — a deactivated account stops getting events by its expiry.
  const expiry = setTimeout(() => {
    res.write(hub.frame("token-expired", {}));
    res.end();
  }, Math.max(tokenExpiresAt - Date.now(), 0));

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unsubscribe();
  };
  // `close` fires when the client goes away and after res.end().
  req.on("close", cleanup);
  res.on("close", cleanup);
  // A write to a socket that's already gone — `close` follows and cleans up.
  res.on("error", cleanup);

  try {
    const unreadCount = await countUnread(userID);
    if (!closed) res.write(hub.frame("unread-count", { unreadCount }));
  } catch (err) {
    // The stream still works without it; the client's own list fetch has the count.
    console.error(`[notifications] couldn't read unread count for user ${userID}: ${err.message}`);
  }
};

module.exports = { openStream };
