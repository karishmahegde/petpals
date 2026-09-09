import { formatLongDate } from "../../../logic/utils/datetime";

// Reusable heading block for the top of a dashboard section — used across every
// role and page. The overview/landing page passes `showDate` and a greeting
// title; inner pages pass a static title + emoji and just a message.

interface DashboardHeadingProps {
  /** Main heading text — e.g. "Good morning, Emelie" or "My Pets". */
  title: string;
  /** Optional emoji rendered after the title. */
  emoji?: string;
  /** Per-page message shown on the subtitle line. */
  message: string;
  /** When true, today's date is shown before the message, separated by "·". */
  showDate?: boolean;
}

const DashboardHeading = ({
  title,
  emoji,
  message,
  showDate = false,
}: DashboardHeadingProps) => (
  <header className="mb-3 md:mb-8">
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
  </header>
);

export default DashboardHeading;
