import type { ReactNode } from "react";
import { formatLongDate } from "../../../logic/utils/datetime";

// Reusable heading block for the top of a dashboard section — used across every
// role and page. The overview/landing page passes `showDate` and a greeting
// title; inner pages pass a static title + emoji and just a message. The
// optional `action` renders a button at the top right (e.g. "+ Schedule
// Visit") — generic so other roles' sections can reuse it for their own
// primary action later.

interface DashboardHeadingAction {
  label: string;
  onClick: () => void;
  /** Icon rendered before the label, e.g. <FaPlus />. */
  icon?: ReactNode;
}

interface DashboardHeadingProps {
  /** Main heading text — e.g. "Good morning, Emelie" or "My Pets". */
  title: string;
  /** Optional emoji rendered after the title. */
  emoji?: string;
  /** Per-page message shown on the subtitle line. */
  message: string;
  /** When true, today's date is shown before the message, separated by "·". */
  showDate?: boolean;
  /** Primary action button, right-aligned against the heading block. */
  action?: DashboardHeadingAction;
}

const DashboardHeading = ({
  title,
  emoji,
  message,
  showDate = false,
  action,
}: DashboardHeadingProps) => (
  <header className="mb-3 flex items-center justify-between gap-4 md:mb-8">
    <div>
      <h1 className="font-display text-3xl leading-tight text-neutral-dark">
        {title}
        {emoji && (
          <span className="ml-2" aria-hidden>
            {emoji}
          </span>
        )}
      </h1>
      <p className="font-body text-xs text-neutral-gray">
        {showDate && (
          <>
            <span>{formatLongDate()}</span>
            <span className="mx-2">·</span>
          </>
        )}
        {message}
      </p>
    </div>

    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-gold-md px-4 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:brightness-95"
      >
        {action.icon}
        {action.label}
      </button>
    )}
  </header>
);

export default DashboardHeading;
