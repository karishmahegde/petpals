// GET /notifications/stream (services/notifications/stream.js + its
// controller): the SSE headers, the opening unread-count, heartbeats, the
// token-expired end at the access token's expiry, and unsubscribing from the
// hub however the stream closes. req/res are EventEmitter fakes; Prisma is
// mocked and timers are faked.
const { EventEmitter } = require("events");

jest.mock("../../../config/prisma", () => ({
  notification: { count: jest.fn() },
}));
jest.mock("../../../services/notifications/hub", () => ({
  ...jest.requireActual("../../../services/notifications/hub"),
  subscribe: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const hub = require("../../../services/notifications/hub");
const { openStream } = require("../../../services/notifications/stream");
const { STREAM_HEARTBEAT_MS } = require("../../../config/notifications");
const controller = require("../../../controllers/notifications/notifications.controller");

const USER_ID = 7;
const MINUTE = 60 * 1000;

const fakeReq = () => new EventEmitter();
const fakeRes = () => {
  const res = new EventEmitter();
  res.status = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn(() => res.emit("close"));
  return res;
};

// Every chunk written so far, in order.
const writes = (res) => res.write.mock.calls.map(([chunk]) => chunk);

let unsubscribe;
let consoleErrorSpy;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  unsubscribe = jest.fn();
  hub.subscribe.mockReturnValue(unsubscribe);
  prisma.notification.count.mockResolvedValue(3);
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  consoleErrorSpy.mockRestore();
});

const open = async ({ expiresIn = 15 * MINUTE } = {}) => {
  const req = fakeReq();
  const res = fakeRes();
  await openStream(USER_ID, Date.now() + expiresIn, req, res);
  return { req, res };
};

test("answers 200 as an unbuffered event stream and flushes the headers at once", async () => {
  const { res } = await open();

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.set).toHaveBeenCalledWith({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  expect(res.flushHeaders).toHaveBeenCalled();
});

test("subscribes the response to the user's events", async () => {
  const { res } = await open();

  expect(hub.subscribe).toHaveBeenCalledWith(USER_ID, res);
});

test("opens with the user's unread count", async () => {
  const { res } = await open();

  expect(prisma.notification.count).toHaveBeenCalledWith({
    where: { userID: USER_ID, readAt: null },
  });
  expect(writes(res)).toEqual(['event: unread-count\ndata: {"unreadCount":3}\n\n']);
});

test("a failed count is logged and the stream stays open", async () => {
  prisma.notification.count.mockRejectedValue(new Error("connection lost"));

  const { res } = await open();

  expect(writes(res)).toEqual([]);
  expect(res.end).not.toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    expect.stringContaining(`unread count for user ${USER_ID}: connection lost`),
  );
  jest.advanceTimersByTime(STREAM_HEARTBEAT_MS);
  expect(writes(res)).toEqual([": heartbeat\n\n"]);
});

test("a client gone before the count arrives gets no write", async () => {
  const req = fakeReq();
  const res = fakeRes();
  let resolveCount;
  prisma.notification.count.mockReturnValue(
    new Promise((resolve) => {
      resolveCount = resolve;
    }),
  );

  const opening = openStream(USER_ID, Date.now() + 15 * MINUTE, req, res);
  req.emit("close");
  resolveCount(3);
  await opening;

  expect(res.write).not.toHaveBeenCalled();
});

test("sends a heartbeat comment every STREAM_HEARTBEAT_MS", async () => {
  const { res } = await open();
  res.write.mockClear();

  jest.advanceTimersByTime(STREAM_HEARTBEAT_MS - 1);
  expect(res.write).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  expect(writes(res)).toEqual([": heartbeat\n\n"]);

  jest.advanceTimersByTime(2 * STREAM_HEARTBEAT_MS);
  expect(res.write).toHaveBeenCalledTimes(3);
});

test("at the token's expiry, sends token-expired and ends the stream", async () => {
  const { res } = await open({ expiresIn: 2 * MINUTE });
  res.write.mockClear();

  jest.advanceTimersByTime(2 * MINUTE - 1);
  expect(res.end).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  expect(writes(res).at(-1)).toBe("event: token-expired\ndata: {}\n\n");
  expect(res.end).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("an already-expired token ends the stream straight away", async () => {
  const { res } = await open({ expiresIn: -MINUTE });

  jest.advanceTimersByTime(0);
  expect(res.end).toHaveBeenCalledTimes(1);
});

test("no heartbeat or expiry fires once the stream has ended", async () => {
  const { res } = await open({ expiresIn: MINUTE });

  jest.advanceTimersByTime(MINUTE);
  res.write.mockClear();
  jest.advanceTimersByTime(10 * STREAM_HEARTBEAT_MS);

  expect(res.write).not.toHaveBeenCalled();
  expect(res.end).toHaveBeenCalledTimes(1);
});

test.each([
  ["the client disconnects (req close)", (req) => req.emit("close")],
  ["the response closes", (req, res) => res.emit("close")],
  ["a write fails (res error)", (req, res) => res.emit("error", new Error("EPIPE"))],
])("when %s: unsubscribes once and stops every timer", async (_label, close) => {
  const { req, res } = await open();
  res.write.mockClear();

  close(req, res);
  req.emit("close");
  res.emit("close");

  expect(unsubscribe).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(20 * MINUTE);
  expect(res.write).not.toHaveBeenCalled();
  expect(res.end).not.toHaveBeenCalled();
});

test("the controller opens the caller's stream with their token's expiry", async () => {
  const req = fakeReq();
  req.user = { userID: USER_ID, role: "Adopter" };
  req.tokenExpiresAt = Date.now() + MINUTE;
  const res = fakeRes();

  await controller.streamNotifications(req, res);

  expect(hub.subscribe).toHaveBeenCalledWith(USER_ID, res);
  jest.advanceTimersByTime(MINUTE);
  expect(res.end).toHaveBeenCalled();
});
