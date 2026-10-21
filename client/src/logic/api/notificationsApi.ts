// notificationsApi.ts
// The signed-in user's own in-app notifications (every role) — GET/PATCH
// /notifications, GET /notifications/unread-count, PATCH /notifications/:id,
// and the live stream GET /notifications/stream.
import axiosInstance from "./axiosInstance";
import type { Pagination } from "./petsApi";

// The server's NotificationType enum.
export type NotificationType =
  | "ApplicationSubmitted"
  | "ApplicationApproved"
  | "ApplicationDeclined"
  | "VisitConfirmed"
  | "VisitCancelled"
  | "AppointmentScheduled"
  | "AppointmentChanged"
  | "AppointmentCancelled"
  | "GovernmentIdVerified"
  | "GovernmentIdRejected"
  | "NewApplication"
  | "NewVisitRequest"
  | "ApplicationWithdrawn"
  | "VisitCancelledByAdopter"
  | "SignupReadyForApproval"
  | "TransferIncoming"
  | "TransferCompleted"
  | "TransferRejected"
  | "TransferCancelled"
  | "CapacityAlert"
  | "AppointmentAssigned"
  | "TaskAssigned"
  | "EventAssigned"
  | "EventCancelled"
  | "AppointmentAssistAssigned"
  | "AppointmentAssistCancelled"
  | "DonationReceived"
  | "AdminSignupPending";

// Text is written server-side — the client only renders it. `link` is a
// client path (e.g. "/adopter/visits"), null when there's nowhere to go.
export interface AppNotification {
  notificationID: number;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsParams {
  unread?: boolean;
  page?: number;
  limit?: number;
}

export interface NotificationsPage {
  data: AppNotification[];
  pagination: Pagination;
  // The user's total unread, whatever the filter or page.
  unreadCount: number;
}

export const getNotifications = async (
  params: NotificationsParams = {},
): Promise<NotificationsPage> => {
  const response = await axiosInstance.get("/notifications", {
    params: {
      ...(params.unread ? { unread: "true" } : {}),
      page: params.page,
      limit: params.limit,
    },
  });
  const { data, pagination, unreadCount } = response.data;
  return { data, pagination, unreadCount };
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await axiosInstance.get("/notifications/unread-count");
  return response.data.data.unreadCount;
};

export const markNotification = async (
  notificationID: number,
  read: boolean,
): Promise<{ notification: AppNotification; unreadCount: number }> => {
  const response = await axiosInstance.patch(`/notifications/${notificationID}`, {
    read,
  });
  return response.data.data;
};

export const markAllNotificationsRead = async (): Promise<{
  updated: number;
  unreadCount: 0;
}> => {
  const response = await axiosInstance.patch("/notifications", { read: true });
  return response.data.data;
};

// ——————————————— Live stream ———————————————
// Server-Sent Events, read with fetch rather than EventSource so the access
// token can go in the Authorization header (EventSource can't send headers).
export type NotificationStreamEvent =
  | { event: "notification"; data: AppNotification }
  | { event: "unread-count"; data: { unreadCount: number } }
  | { event: "token-expired"; data: Record<string, never> };

// The stream couldn't open — `status` is the HTTP status (401 when the
// token was refused).
export class NotificationStreamError extends Error {
  constructor(readonly status: number) {
    super(`Notification stream refused (${status})`);
  }
}

const STREAM_EVENTS = new Set(["notification", "unread-count", "token-expired"]);

// One SSE block ("event: x\ndata: {...}") → an event, or null for a
// heartbeat comment or anything unrecognised.
const parseBlock = (block: string): NotificationStreamEvent | null => {
  let event = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!STREAM_EVENTS.has(event)) return null;
  try {
    return { event, data: JSON.parse(data) } as NotificationStreamEvent;
  } catch {
    return null;
  }
};

// Opens the stream and calls `onOpen` once it's accepted, then `onEvent`
// for each event. Resolves when the server ends the stream; rejects with a
// NotificationStreamError if it's refused, or with the abort/network error.
export const openNotificationStream = async ({
  token,
  signal,
  onOpen,
  onEvent,
}: {
  token: string;
  signal: AbortSignal;
  onOpen: () => void;
  onEvent: (event: NotificationStreamEvent) => void;
}): Promise<void> => {
  // In production REST goes through Vercel's /api rewrite, but the stream
  // connects to the API directly (VITE_STREAM_URL) so no proxy can buffer
  // it; locally both are the same URL.
  const baseUrl = import.meta.env.VITE_STREAM_URL || import.meta.env.VITE_API_URL;
  const response = await fetch(
    `${baseUrl}/notifications/stream`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal,
    },
  );
  if (!response.ok || !response.body) {
    throw new NotificationStreamError(response.status);
  }
  onOpen();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const parsed = parseBlock(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (parsed) onEvent(parsed);
      end = buffer.indexOf("\n\n");
    }
  }
};
