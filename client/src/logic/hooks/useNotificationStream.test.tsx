// useNotificationStream: holds the live stream open while signed in, folds
// its events into the query cache, reconnects with backoff, renews the token
// when the stream ends at its expiry, and ends the session when renewing
// can't help. The stream, token refresh and chime are faked; the clock is too.
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import useNotificationStream from "./useNotificationStream";
import useAuthStore from "../store/useAuthStore";
import { notificationKeys } from "../notifications/notificationKeys";
import { testQueryClient } from "../../test/render";
import {
  NotificationStreamError,
  openNotificationStream,
  type NotificationStreamEvent,
} from "../api/notificationsApi";
import { refreshToken } from "../api/authApi";
import { playNotificationSound, primeNotificationSound } from "../notifications/notificationSound";

vi.mock("../api/notificationsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/notificationsApi")>()),
  openNotificationStream: vi.fn(),
}));
vi.mock("../api/authApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/authApi")>()),
  refreshToken: vi.fn(),
}));
vi.mock("../notifications/notificationSound", () => ({
  playNotificationSound: vi.fn(),
  primeNotificationSound: vi.fn(),
}));

type StreamOptions = Parameters<typeof openNotificationStream>[0];

// Each openNotificationStream call becomes a stream the test drives.
interface FakeStream {
  options: StreamOptions;
  open: () => void;
  emit: (event: NotificationStreamEvent) => void;
  end: () => void;
  fail: (err: Error) => void;
}
let streams: FakeStream[];

const signIn = (token = "token-1", role = "Adopter") =>
  useAuthStore.setState({ user: { userID: 7, role }, token, role });

const renderStream = () => {
  const queryClient = testQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useNotificationStream(), { wrapper });
  return { queryClient, ...view };
};

// Lets pending promises (the stream's settle, the hook's awaits) run.
const flush = () => act(async () => {});

let locationHref: string;

beforeEach(() => {
  vi.useFakeTimers();
  streams = [];
  vi.mocked(openNotificationStream).mockReset();
  vi.mocked(openNotificationStream).mockImplementation(
    (options) =>
      new Promise<void>((resolve, reject) => {
        streams.push({
          options,
          open: () => options.onOpen(),
          emit: (event) => options.onEvent(event),
          end: resolve,
          fail: reject,
        });
      }),
  );
  vi.mocked(refreshToken).mockReset();
  vi.mocked(playNotificationSound).mockReset();
  vi.mocked(primeNotificationSound).mockReset();
  // endSession sends the browser to the login page — capture it instead.
  locationHref = "";
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return locationHref;
      },
      set href(value: string) {
        locationHref = value;
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("connecting", () => {
  test("signed out: no stream", () => {
    renderStream();

    expect(openNotificationStream).not.toHaveBeenCalled();
  });

  test("signed in: one stream with the access token, and the chime is primed", () => {
    signIn("token-1");
    renderStream();

    expect(openNotificationStream).toHaveBeenCalledTimes(1);
    expect(streams[0].options.token).toBe("token-1");
    expect(primeNotificationSound).toHaveBeenCalled();
  });

  test("once open, every notification query is refetched (catch-up after a gap)", () => {
    signIn();
    const { queryClient } = renderStream();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() => streams[0].open());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all });
  });
});

describe("events", () => {
  test("unread-count sets the badge's count", () => {
    signIn();
    const { queryClient } = renderStream();

    act(() => streams[0].emit({ event: "unread-count", data: { unreadCount: 4 } }));

    expect(queryClient.getQueryData(notificationKeys.unreadCount)).toBe(4);
  });

  test("a notification adds one, chimes with its ID and refreshes the lists", () => {
    signIn();
    const { queryClient } = renderStream();
    queryClient.setQueryData(notificationKeys.unreadCount, 2);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() =>
      streams[0].emit({ event: "notification", data: { notificationID: 41 } as never }),
    );

    expect(queryClient.getQueryData(notificationKeys.unreadCount)).toBe(3);
    expect(playNotificationSound).toHaveBeenCalledWith(41);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.lists });
  });

  test("a notification before the count has loaded leaves it unset (the fetch will fill it)", () => {
    signIn();
    const { queryClient } = renderStream();

    act(() => streams[0].emit({ event: "notification", data: { notificationID: 41 } as never }));

    expect(queryClient.getQueryData(notificationKeys.unreadCount)).toBeUndefined();
  });
});

describe("reconnecting", () => {
  test("a dropped stream reconnects after 1s, then 2s, 4s… up to 30s", async () => {
    signIn();
    renderStream();

    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      act(() => streams[i].fail(new TypeError("Failed to fetch")));
      await flush();
      const before = streams.length;
      // Find how long until the next attempt.
      let waited = 0;
      while (streams.length === before) {
        await act(() => vi.advanceTimersByTimeAsync(1000));
        waited += 1000;
      }
      waits.push(waited);
    }

    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  test("a stream that opened resets the wait to 1s", async () => {
    signIn();
    renderStream();
    act(() => streams[0].fail(new TypeError("offline")));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => streams[1].fail(new TypeError("offline")));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(2000));

    act(() => streams[2].open());
    act(() => streams[2].end());
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(streams).toHaveLength(4);
  });

  test("signing out stops the stream and any pending reconnect", async () => {
    signIn();
    const { unmount } = renderStream();
    act(() => streams[0].fail(new TypeError("offline")));
    await flush();

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60000));

    expect(streams).toHaveLength(1);
    expect(streams[0].options.signal.aborted).toBe(true);
  });
});

describe("token renewal", () => {
  test("token-expired: renews with the refresh cookie and reconnects with the new token", async () => {
    signIn("token-1");
    vi.mocked(refreshToken).mockResolvedValue({ token: "token-2" } as never);
    renderStream();

    act(() => streams[0].emit({ event: "token-expired", data: {} }));
    act(() => streams[0].end());
    await flush();

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe("token-2");
    expect(streams[streams.length - 1].options.token).toBe("token-2");
  });

  test("a 401 when opening is treated the same way", async () => {
    signIn("token-1");
    vi.mocked(refreshToken).mockResolvedValue({ token: "token-2" } as never);
    renderStream();

    act(() => streams[0].fail(new NotificationStreamError(401)));
    await flush();

    expect(useAuthStore.getState().token).toBe("token-2");
  });

  test("the first refresh failing (another tab rotated the cookie): one retry after 1s", async () => {
    signIn("token-1");
    vi.mocked(refreshToken)
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce({ token: "token-2" } as never);
    renderStream();

    act(() => streams[0].fail(new NotificationStreamError(401)));
    await flush();
    expect(useAuthStore.getState().token).toBe("token-1");

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(refreshToken).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().token).toBe("token-2");
  });

  test("both refreshes failing ends the session at the role's login page", async () => {
    signIn("token-1", "Staff");
    vi.mocked(refreshToken).mockRejectedValue(new Error("401"));
    renderStream();

    act(() => streams[0].fail(new NotificationStreamError(401)));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(useAuthStore.getState().token).toBeNull();
    expect(locationHref).toBe("/staff-portal/login");
  });

  test("refused again within 10s of renewing (account closed meanwhile): the session ends, no refresh loop", async () => {
    signIn("token-1");
    vi.mocked(refreshToken).mockResolvedValue({ token: "token-2" } as never);
    renderStream();
    act(() => streams[0].fail(new NotificationStreamError(401)));
    await flush();
    expect(useAuthStore.getState().token).toBe("token-2");

    act(() => streams[streams.length - 1].fail(new NotificationStreamError(401)));
    await flush();

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
    expect(locationHref).toBe("/login");
  });
});
