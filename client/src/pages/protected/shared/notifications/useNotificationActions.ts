// Mark-read actions shared by the bell's dropdown and the Notifications page.
// Each reply carries the new unread count, so the bell updates at once; the
// lists refetch. (Other open tabs hear the new count on their live stream.)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  markAllNotificationsRead,
  markNotification,
} from "../../../../logic/api/notificationsApi";
import { notificationKeys } from "../../../../logic/notifications/notificationKeys";

const useNotificationActions = () => {
  const queryClient = useQueryClient();

  const settle = (unreadCount: number) => {
    queryClient.setQueryData<number>(notificationKeys.unreadCount, unreadCount);
    queryClient.invalidateQueries({ queryKey: notificationKeys.lists });
  };

  const mark = useMutation({
    mutationFn: ({ notificationID, read }: { notificationID: number; read: boolean }) =>
      markNotification(notificationID, read),
    onSuccess: ({ unreadCount }) => settle(unreadCount),
    onError: () => toast.error("Couldn't update that notification. Please try again."),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: ({ unreadCount }) => settle(unreadCount),
    onError: () => toast.error("Couldn't mark your notifications read. Please try again."),
  });

  return { mark, markAll };
};

export default useNotificationActions;
