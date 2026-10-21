// @vitest-environment node
// openNotificationStream reads Server-Sent Events off a fetch response (not
// EventSource, which can't send the Bearer header). These feed it a fake
// streamed body, chunk by chunk, and check what it reports.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  NotificationStreamError,
  openNotificationStream,
  type NotificationStreamEvent,
} from "./notificationsApi";

const encoder = new TextEncoder();

// A 200 event-stream response whose body arrives as these chunks.
const streamResponse = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_API_URL", "http://api.test/api/v1");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const open = async (chunks: string[]) => {
  fetchMock.mockResolvedValue(streamResponse(chunks));
  const events: NotificationStreamEvent[] = [];
  const onOpen = vi.fn();
  await openNotificationStream({
    token: "tok",
    signal: new AbortController().signal,
    onOpen,
    onEvent: (event) => events.push(event),
  });
  return { events, onOpen };
};

const ITEM = { notificationID: 41, type: "VisitConfirmed", title: "Visit confirmed" };

describe("openNotificationStream", () => {
  test("asks for the stream with the Bearer token", async () => {
    await open([]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/notifications/stream",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok", Accept: "text/event-stream" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test("VITE_STREAM_URL set (production) → the stream goes there, not through VITE_API_URL's rewrite", async () => {
    vi.stubEnv("VITE_API_URL", "/api/v1");
    vi.stubEnv("VITE_STREAM_URL", "https://api.example.test/api/v1");
    await open([]);

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/v1/notifications/stream");
  });

  test("VITE_STREAM_URL blank (local dev) → falls back to VITE_API_URL", async () => {
    vi.stubEnv("VITE_STREAM_URL", "");
    await open([]);

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/v1/notifications/stream");
  });

  test("reports each event in order, once the stream has opened", async () => {
    const { events, onOpen } = await open([
      'event: unread-count\ndata: {"unreadCount":2}\n\n',
      `event: notification\ndata: ${JSON.stringify(ITEM)}\n\n`,
      "event: token-expired\ndata: {}\n\n",
    ]);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      { event: "unread-count", data: { unreadCount: 2 } },
      { event: "notification", data: ITEM },
      { event: "token-expired", data: {} },
    ]);
  });

  test("an event split across chunks (even mid-line) arrives whole", async () => {
    const frame = `event: notification\ndata: ${JSON.stringify(ITEM)}\n\n`;

    const { events } = await open([frame.slice(0, 9), frame.slice(9, 30), frame.slice(30, -1), frame.slice(-1)]);

    expect(events).toEqual([{ event: "notification", data: ITEM }]);
  });

  test("several events in one chunk are all reported", async () => {
    const { events } = await open([
      'event: unread-count\ndata: {"unreadCount":1}\n\nevent: unread-count\ndata: {"unreadCount":0}\n\n',
    ]);

    expect(events.map((e) => e.data)).toEqual([{ unreadCount: 1 }, { unreadCount: 0 }]);
  });

  test("heartbeats, unknown events and bad JSON are skipped, not thrown", async () => {
    const { events } = await open([
      ": heartbeat\n\n",
      'event: something-new\ndata: {"x":1}\n\n',
      "event: notification\ndata: {not json\n\n",
      'event: unread-count\ndata: {"unreadCount":5}\n\n',
    ]);

    expect(events).toEqual([{ event: "unread-count", data: { unreadCount: 5 } }]);
  });

  test("a trailing partial event when the server ends the stream is dropped", async () => {
    const { events } = await open(['event: unread-count\ndata: {"unreadCount":1}\n\n', "event: notifica"]);

    expect(events).toHaveLength(1);
  });

  test("resolves when the server ends the stream", async () => {
    await expect(open(["event: token-expired\ndata: {}\n\n"])).resolves.toBeDefined();
  });

  test.each([401, 403, 500])("a refused stream (%i) rejects with its status, without opening", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    const onOpen = vi.fn();

    const promise = openNotificationStream({
      token: "tok",
      signal: new AbortController().signal,
      onOpen,
      onEvent: vi.fn(),
    });

    await expect(promise).rejects.toBeInstanceOf(NotificationStreamError);
    await expect(promise).rejects.toMatchObject({ status });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a network failure rejects with that error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      openNotificationStream({ token: "tok", signal: new AbortController().signal, onOpen: vi.fn(), onEvent: vi.fn() }),
    ).rejects.toThrow("Failed to fetch");
  });
});
