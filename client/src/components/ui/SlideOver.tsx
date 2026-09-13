// components/ui/SlideOver.tsx
// Generic slide-over panel — a right-side drawer on sm+ screens, a bottom sheet
// with rounded top corners on mobile. Used for "detail" views across the
// dashboards (adopted-pet details, appointment details, …) where a full route
// would be too heavy.
//
// The caller owns "is it open / which record" state and any data fetching;
// SlideOver only does the chrome: backdrop, the responsive slide-in transition,
// a sticky header with the title + close button, and an optional sticky footer.
//
// Kept mounted by the parent (open just flips to false) is fine — it renders
// null while closed and re-arms the entrance transition every time `open`
// goes true, via the `entered` flag + rAF (so the browser paints the
// off-screen state before the flip, making it an observed transition rather
// than a batched no-op).
import { useEffect, useState, type ReactNode } from "react";
import { FaTimes } from "react-icons/fa";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Pinned to the bottom of the panel, above the mobile safe area. */
  footer?: ReactNode;
}

const SlideOver = ({
  open,
  onClose,
  title,
  children,
  footer,
}: SlideOverProps) => {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-stretch sm:justify-end"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white font-body shadow-xl transition-transform duration-300 ease-out sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none ${
          entered
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 py-4">
          <h2 className="font-display text-2xl text-neutral-dark">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-neutral-lightgray p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default SlideOver;
