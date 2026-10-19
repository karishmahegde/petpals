// Query keys for the in-app notifications. Everything sits under
// ["notifications"], so the live stream (useNotificationStream) can refresh
// it all in one invalidate after a reconnect.
import type { NotificationsParams } from "../api/notificationsApi";

export const notificationKeys = {
  all: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  lists: ["notifications", "list"] as const,
  list: (params: NotificationsParams) => ["notifications", "list", params] as const,
};
