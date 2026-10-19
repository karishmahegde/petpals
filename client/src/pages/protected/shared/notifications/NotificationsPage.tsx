// The Notifications page (/<role>/notifications) — the same page on all six
// dashboards, reached from the bell's "View all" (not the sidebar menu, like
// Profile). Every notification, newest first, All or Unread, paginated.
// Opening one marks it read and follows its link, as in the dropdown; each
// row can also be marked read or unread on its own.
//
// The live stream (useNotificationStream) refetches the list when something
// arrives or another tab marks one read.
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PiChecks } from "react-icons/pi";
import Card from "../../../../components/ui/Card";
import ButtonElement from "../../../../components/ui/ButtonElement";
import SegmentedControl from "../../../../components/ui/SegmentedControl";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import {
  getNotifications,
  getUnreadCount,
  type AppNotification,
} from "../../../../logic/api/notificationsApi";
import { notificationKeys } from "../../../../logic/notifications/notificationKeys";
import NotificationItem from "./NotificationItem";
import useNotificationActions from "./useNotificationActions";

const PAGE_SIZE = 20;

type Filter = "all" | "unread";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const { mark, markAll } = useNotificationActions();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
  });

  const params = { unread: filter === "unread", page, limit: PAGE_SIZE };
  const listQuery = useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => getNotifications(params),
    placeholderData: keepPreviousData,
  });
  const items = listQuery.data?.data ?? [];
  const totalPages = listQuery.data?.pagination.totalPages ?? 1;

  // Marking the last unread on a page (Unread filter), or the 90-day clean-up,
  // can leave `page` past the end — step back to the last page that exists.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleOpen = (notification: AppNotification) => {
    if (notification.readAt === null) {
      mark.mutate({ notificationID: notification.notificationID, read: true });
    }
    if (notification.link) navigate(notification.link);
  };

  return (
    <div>
      <DashboardHeading
        title="Notifications"
        emoji="🔔"
        message={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up"
        }
        showDate
        action={
          unreadCount > 0
            ? {
                label: "Mark all as read",
                icon: <PiChecks aria-hidden />,
                onClick: () => markAll.mutate(),
              }
            : undefined
        }
      />

      <Card className="p-6">
        <SegmentedControl
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
          ]}
          value={filter}
          onChange={(value) => {
            setFilter(value as Filter);
            setPage(1);
          }}
          className="mb-5 sm:max-w-xs"
        />

        {listQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {listQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load your notifications. Please try again.
          </p>
        )}
        {listQuery.data && items.length === 0 && (
          <DashboardEmptyMessage>
            {filter === "unread"
              ? "No unread notifications."
              : "No notifications yet — updates about your activity will show up here."}
          </DashboardEmptyMessage>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-neutral-lightgray overflow-hidden rounded-xl border border-neutral-lightgray">
            {items.map((notification) => {
              const unread = notification.readAt === null;
              return (
                <li key={notification.notificationID} className="flex items-stretch">
                  <div className="min-w-0 flex-1">
                    <NotificationItem notification={notification} onOpen={handleOpen} />
                  </div>
                  <ButtonElement
                    onClick={() =>
                      mark.mutate({
                        notificationID: notification.notificationID,
                        read: unread,
                      })
                    }
                    disabled={mark.isPending}
                    size="bare"
                    variant="outline"
                    aria-label={`Mark "${notification.title}" as ${unread ? "read" : "unread"}`}
                    className={`shrink-0 px-4 font-body text-xs text-teal-dark hover:underline disabled:opacity-50 ${
                      unread ? "bg-rose-lightest" : "bg-white"
                    }`}
                  >
                    {unread ? "Mark read" : "Mark unread"}
                  </ButtonElement>
                </li>
              );
            })}
          </ul>
        )}

        <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
      </Card>
    </div>
  );
};

export default NotificationsPage;
