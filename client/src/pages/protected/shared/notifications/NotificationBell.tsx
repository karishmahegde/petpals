// The dashboard navbar's bell: the unread count as a badge, and a dropdown
// of the latest notifications. Rendered by the shared DashboardLayout and
// handed to DashboardNavbar as a slot, since it imports the notifications
// API (the navbar itself stays content-agnostic).
//
// The unread count is the ["notifications", "unread-count"] query, which the
// live stream (useNotificationStream) keeps current. The list is only
// fetched while the dropdown is open.
//
// The speaker toggle in the header turns the new-notification chime on or
// off for this browser (logic/notifications/notificationSound.ts).
//
// Non-modal, like the account menu: an outside click or Escape closes it
// (Escape hands focus back to the bell), and focus moves to its heading on
// open.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaRegBell } from "react-icons/fa";
import { PiSpeakerHighBold, PiSpeakerSlashBold } from "react-icons/pi";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  getNotifications,
  getUnreadCount,
  type AppNotification,
} from "../../../../logic/api/notificationsApi";
import { notificationKeys } from "../../../../logic/notifications/notificationKeys";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from "../../../../logic/notifications/notificationSound";
import { dashboardPathFor } from "../../../../logic/route/resolveDestination";
import useAuthStore from "../../../../logic/store/useAuthStore";
import NotificationItem from "./NotificationItem";
import useNotificationActions from "./useNotificationActions";

const DROPDOWN_LIMIT = 10;
const PANEL_ID = "notifications-dropdown";

// "9+" past nine, so the badge stays one small circle.
const badgeText = (count: number) => (count > 9 ? "9+" : String(count));

const NotificationBell = () => {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(isNotificationSoundEnabled);
  // The wrapper, for outside clicks and finding the bell (its first button)
  // to hand focus back — ButtonElement doesn't forward refs.
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { mark, markAll } = useNotificationActions();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
  });

  const listParams = { limit: DROPDOWN_LIMIT };
  const { data, isLoading, isError } = useQuery({
    queryKey: notificationKeys.list(listParams),
    queryFn: () => getNotifications(listParams),
    enabled: open,
  });

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // Opening one marks it read and follows its link, if it has one.
  const handleOpen = (notification: AppNotification) => {
    if (notification.readAt === null) {
      mark.mutate({ notificationID: notification.notificationID, read: true });
    }
    if (notification.link) goTo(notification.link);
  };

  const notificationsPath = role ? `${dashboardPathFor(role)}/notifications` : null;
  const items = data?.data ?? [];

  return (
    <div ref={rootRef} className="relative">
      <ButtonElement
        onClick={() => setOpen((prev) => !prev)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-controls={PANEL_ID}
        size="bare"
        variant="outline"
        className="relative text-rose-dark hover:text-teal-dark transition-colors"
      >
        <FaRegBell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-dark px-1 font-body text-[10px] font-semibold text-white ring-2 ring-rose-lightest"
          >
            {badgeText(unreadCount)}
          </span>
        )}
      </ButtonElement>

      {open && (
        <div
          id={PANEL_ID}
          role="region"
          aria-label="Notifications"
          // Phone: full width under the navbar (top-24 = its height);
          // wider screens: anchored under the bell.
          className="fixed inset-x-4 top-24 z-50 overflow-hidden rounded-xl bg-white shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-offwhite px-4 py-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-body text-sm font-semibold text-neutral-dark focus:outline-none"
            >
              Notifications
            </h2>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <ButtonElement
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  size="bare"
                  variant="outline"
                  className="font-body text-xs text-teal-dark hover:underline disabled:opacity-50"
                >
                  Mark all as read
                </ButtonElement>
              )}
              <ButtonElement
                onClick={() => {
                  setNotificationSoundEnabled(!soundOn);
                  setSoundOn(!soundOn);
                }}
                aria-pressed={soundOn}
                aria-label="Notification sound"
                title={soundOn ? "Sound on — click to mute" : "Sound off — click to unmute"}
                size="bare"
                variant="outline"
                className="text-neutral-gray hover:text-teal-dark"
              >
                {soundOn ? (
                  <PiSpeakerHighBold className="h-5 w-5" />
                ) : (
                  <PiSpeakerSlashBold className="h-5 w-5" />
                )}
              </ButtonElement>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <DashboardEmptyMessage className="px-4 py-6 text-center">
                Loading notifications…
              </DashboardEmptyMessage>
            )}
            {isError && (
              <DashboardEmptyMessage className="px-4 py-6 text-center">
                Couldn't load your notifications. Please try again.
              </DashboardEmptyMessage>
            )}
            {data && items.length === 0 && (
              <DashboardEmptyMessage className="px-4 py-6 text-center">
                You're all caught up — nothing here yet.
              </DashboardEmptyMessage>
            )}
            {items.length > 0 && (
              <ul className="divide-y divide-neutral-offwhite">
                {items.map((notification) => (
                  <li key={notification.notificationID}>
                    <NotificationItem notification={notification} onOpen={handleOpen} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notificationsPath && (
            <ButtonElement
              onClick={() => goTo(notificationsPath)}
              size="bare"
              variant="outline"
              className="block w-full border-t border-neutral-offwhite px-4 py-3 text-center font-body text-sm text-teal-dark hover:bg-gold-light"
            >
              View all
            </ButtonElement>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
