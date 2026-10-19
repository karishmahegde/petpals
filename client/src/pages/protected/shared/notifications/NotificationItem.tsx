// One notification — a row in the bell's dropdown and on the Notifications
// page. The whole row is one button (open it); unread ones get a dot and a
// bold title. Renders and reports up only — the caller decides what opening
// does (mark read, follow the link, close the dropdown).
import ButtonElement from "../../../../components/ui/ButtonElement";
import type { AppNotification } from "../../../../logic/api/notificationsApi";
import { formatRelativeTime } from "../../../../logic/utils/datetime";

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}

const NotificationItem = ({ notification, onOpen }: NotificationItemProps) => {
  const unread = notification.readAt === null;

  return (
    <ButtonElement
      onClick={() => onOpen(notification)}
      size="bare"
      variant="outline"
      aria-label={`${unread ? "Unread: " : ""}${notification.title}. ${notification.body}`}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gold-light ${
        unread ? "bg-rose-lightest" : "bg-white"
      }`}
    >
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-rose-dark" : "bg-transparent"}`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block font-body text-sm text-neutral-dark ${unread ? "font-semibold" : ""}`}
        >
          {notification.title}
        </span>
        <span className="mt-0.5 block font-body text-xs text-neutral-charcoal">
          {notification.body}
        </span>
        <span className="mt-1 block font-body text-[11px] text-neutral-gray">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </ButtonElement>
  );
};

export default NotificationItem;
