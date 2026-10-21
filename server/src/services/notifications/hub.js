// In-process pub/sub for the live notification stream (GET /notifications/stream).
// Each open stream is an Express `res` registered under its user; publish()
// writes one Server-Sent Event to every stream that user has open (one per
// tab). Only index.js requires this file.
//
// It lives in memory, so it only reaches streams on THIS server process —
// fine for the single Render instance. Scaling out would need Postgres
// LISTEN/NOTIFY behind the same publish(). Nothing is lost if a push misses:
// the rows are already stored, and the client refetches when it reconnects.
const streams = new Map(); // userID → Set<res>

// Registers a stream; returns the function that removes it (call on `close`).
const subscribe = (userID, res) => {
  if (!streams.has(userID)) streams.set(userID, new Set());
  streams.get(userID).add(res);
  return () => unsubscribe(userID, res);
};

const unsubscribe = (userID, res) => {
  const userStreams = streams.get(userID);
  if (!userStreams) return;
  userStreams.delete(res);
  if (userStreams.size === 0) streams.delete(userID);
};

// One SSE frame: `event:` names it, `data:` carries JSON on a single line.
const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// Sends an event to every stream the user has open. A stream that fails to
// write has gone away without a `close` yet — drop it.
const publish = (userID, event, data) => {
  const userStreams = streams.get(userID);
  if (!userStreams) return;
  const message = frame(event, data);
  for (const res of [...userStreams]) {
    try {
      res.write(message);
    } catch {
      unsubscribe(userID, res);
    }
  }
};

module.exports = { subscribe, publish, frame };
