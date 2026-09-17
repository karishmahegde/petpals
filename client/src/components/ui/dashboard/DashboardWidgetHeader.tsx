// components/ui/dashboard/DashboardWidgetHeader.tsx
// The title row shared by nearly every dashboard widget: an emoji/icon + title
// on the left, an optional "View All"-style link on the right. Role-agnostic —
// every dashboard's widgets use the same shape. Also exports
// OverviewWidgetCard, the generic Card + header + loading/empty/content body
// wrapper built on top of it — see that component's own comment below.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Card from "../Card";
import DashboardEmptyMessage from "./DashboardEmptyMessage";

interface DashboardWidgetHeaderProps {
  /** Emoji or icon node shown before the title. */
  icon?: ReactNode;
  title: ReactNode;
  /** Optional trailing link, right-aligned. An arrow is appended to `label`. */
  action?: { label: string; to: string };
  /** Extra classes on the wrapper (e.g. a different bottom margin). */
  className?: string;
}

const DashboardWidgetHeader = ({
  icon,
  title,
  action,
  className = "",
}: DashboardWidgetHeaderProps) => (
  <div
    className={`mb-3 flex shrink-0 items-center justify-between ${className}`}
  >
    <h2 className="font-display text-2xl text-neutral-dark">
      {icon != null && <>{icon} </>}
      {title}
    </h2>
    {action && (
      <Link
        to={action.to}
        className="font-body text-sm text-rose-dark hover:underline"
      >
        {action.label} →
      </Link>
    )}
  </div>
);

export default DashboardWidgetHeader;

// components/ui/dashboard/OverviewWidgetCard
// The generic Overview-widget shell: Card + DashboardWidgetHeader + a body
// that's either a loading line, a centered empty state (message + optional
// action, vertically centered in whatever space the card has — the adopter
// dashboard's original styling), or the widget's own loaded content. Every
// role's Overview widgets (Adopter, Staff, Admin) are built on this so the
// loading/empty treatment can't drift between them; a widget with a body
// that doesn't fit this shape (e.g. MonthlyStatsWidget's chart + year
// picker) just uses DashboardWidgetHeader directly instead.
interface OverviewWidgetCardProps {
  icon?: ReactNode;
  title: ReactNode;
  action?: { label: string; to: string };
  isLoading?: boolean;
  loadingMessage?: ReactNode;
  isEmpty: boolean;
  emptyMessage: ReactNode;
  /** Rendered under the empty message — e.g. an "Explore Pets" button. */
  emptyAction?: ReactNode;
  /** Card sizing — a fixed/min height, width, etc. Layout only. */
  className?: string;
  /** The widget's own loaded content. Ignored while loading or empty. */
  children?: ReactNode;
}

export const OverviewWidgetCard = ({
  icon,
  title,
  action,
  isLoading = false,
  loadingMessage = "Loading…",
  isEmpty,
  emptyMessage,
  emptyAction,
  className = "",
  children,
}: OverviewWidgetCardProps) => (
  <Card className={`flex flex-col p-5 ${className}`}>
    <DashboardWidgetHeader icon={icon} title={title} action={action} />
    <div className="flex flex-1 flex-col overflow-auto">
      {isLoading ? (
        <p className="font-body text-sm text-neutral-gray">{loadingMessage}</p>
      ) : isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <DashboardEmptyMessage>{emptyMessage}</DashboardEmptyMessage>
          {emptyAction}
        </div>
      ) : (
        children
      )}
    </div>
  </Card>
);
