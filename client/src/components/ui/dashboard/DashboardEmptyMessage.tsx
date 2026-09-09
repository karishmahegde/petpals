// components/ui/dashboard/DashboardEmptyMessage.tsx
// The muted one-line message shown when a dashboard widget or section has
// nothing to list ("No upcoming visits", "You have not fostered any pets
// yet."). Just the styled line — callers own the surrounding layout wrapper
// and any call-to-action rendered beneath it.
import type { ReactNode } from "react";

interface DashboardEmptyMessageProps {
  children: ReactNode;
  /** Extra classes, e.g. a bottom margin when a CTA follows. */
  className?: string;
}

const DashboardEmptyMessage = ({
  children,
  className = "",
}: DashboardEmptyMessageProps) => (
  <p className={`font-body text-xs text-neutral-gray ${className}`}>
    {children}
  </p>
);

export default DashboardEmptyMessage;
