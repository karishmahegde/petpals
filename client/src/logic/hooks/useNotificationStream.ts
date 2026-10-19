// Keeps the signed-in user's notifications live: holds the server's
// notification stream open (GET /notifications/stream) and folds each event
// into the ["notifications"] query cache. Mounted once, in the shared
// DashboardLayout, so it runs on every dashboard page and stops on logout
// (the layout unmounts and the token clears).
//
// The database is the record and the stream only nudges, so every
// (re)connect invalidates the notification queries — anything sent while
// disconnected is picked up from the list.
//
// Token expiry: the server ends the stream when the access token expires
// (`token-expired`). The hook renews it with the refresh cookie and puts the
// new token in the auth store, which re-runs the effect with it — so an open
// dashboard stays signed in for the refresh token's life, not the access
// token's 15 minutes. If renewal fails, the session ends the way a 401 does
// in axiosInstance.
import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import useAuthStore from "../store/useAuthStore";
import { refreshToken } from "../api/authApi";
import { loginPathFor } from "../route/resolveDestination";
import {
  NotificationStreamError,
  openNotificationStream,
  type NotificationStreamEvent,
} from "../api/notificationsApi";
import { notificationKeys } from "../notifications/notificationKeys";

// Reconnect backoff after a dropped stream: doubles from MIN up to MAX, and
// resets once a stream opens.
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

// The refresh token rotates on every use, so two tabs renewing at the same
// moment can find the cookie already replaced by the other — waiting a
// moment and trying once more picks up the new one.
const REFRESH_RETRY_DELAY_MS = 1_000;

// A token refused this soon after renewing means renewing won't help (the
// account was closed, deactivated…) — end the session rather than loop.
const RENEWAL_GUARD_MS = 10_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const applyEvent = (queryClient: QueryClient, event: NotificationStreamEvent) => {
  if (event.event === "notification") {
    queryClient.setQueryData<number>(notificationKeys.unreadCount, (count) =>
      count === undefined ? undefined : count + 1,
    );
  } else if (event.event === "unread-count") {
    queryClient.setQueryData<number>(notificationKeys.unreadCount, event.data.unreadCount);
  }
  // A new notification, or read states changed in another tab — refetch
  // whichever lists are on screen.
  queryClient.invalidateQueries({ queryKey: notificationKeys.lists });
};

// The same ending as a 401 in axiosInstance.
const endSession = () => {
  const { role, logout } = useAuthStore.getState();
  logout();
  window.location.href = loginPathFor(role);
};

const useNotificationStream = () => {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const lastRenewalAt = useRef(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let retryDelay = RETRY_MIN_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Swaps in a fresh token; the store change re-runs this effect, which
    // reconnects with it. Skipped if this stream was torn down meanwhile
    // (logged out, or another renewal already landed).
    const renew = async () => {
      if (Date.now() - lastRenewalAt.current < RENEWAL_GUARD_MS) {
        endSession();
        return;
      }
      lastRenewalAt.current = Date.now();
      try {
        let renewed;
        try {
          renewed = await refreshToken();
        } catch {
          await wait(REFRESH_RETRY_DELAY_MS);
          renewed = await refreshToken();
        }
        if (!controller.signal.aborted && useAuthStore.getState().token === token) {
          useAuthStore.getState().setToken(renewed.token);
        }
      } catch {
        if (!controller.signal.aborted) endSession();
      }
    };

    const connect = async () => {
      let expired = false;
      try {
        await openNotificationStream({
          token,
          signal: controller.signal,
          onOpen: () => {
            retryDelay = RETRY_MIN_MS;
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          },
          onEvent: (event) => {
            if (event.event === "token-expired") expired = true;
            else applyEvent(queryClient, event);
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof NotificationStreamError && err.status === 401) expired = true;
        // Anything else — offline, server restarting — retries below.
      }
      if (controller.signal.aborted) return;

      if (expired) {
        await renew();
        return;
      }
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    };

    connect();
    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [token, queryClient]);
};

export default useNotificationStream;
