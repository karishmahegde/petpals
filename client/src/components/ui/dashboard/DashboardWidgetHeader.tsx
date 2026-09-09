// components/ui/dashboard/DashboardWidgetHeader.tsx
// The title row shared by nearly every dashboard widget: an emoji/icon + title
// on the left, an optional "View All"-style link on the right. Role-agnostic —
// every dashboard's widgets use the same shape.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
