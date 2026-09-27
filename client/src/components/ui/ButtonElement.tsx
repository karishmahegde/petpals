// components/ui/ButtonElement.tsx
// The one button component for the whole app — every clickable <button> (and
// every button-shaped <Link>) goes through this, from page CTAs down to
// icon-only/text-link controls, so styling and behavior never drift into a
// parallel hand-rolled pattern per feature.
import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes } from "react";

type ButtonSize = "md" | "sm" | "panel" | "bare";
type ButtonVariant = "solid" | "outline";

// Colour (and width — e.g. "w-full" or "flex-1") comes from `className`
// (e.g. "bg-teal-dark hover:bg-gold-dark"). Typography/shape is fixed per
// size below.
const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "my-5 rounded-md px-6 py-2 text-xs font-light", // default page CTA
  sm: "rounded-lg px-4 py-2 text-xs font-light", // compact, e.g. a dashboard row action
  // Detail-panel action buttons (Edit, Save, Accept/Reject, Approve/Decline, …)
  // — centered so a `w-full`/`flex-1` caller doesn't need its own text-align.
  panel: "rounded-xl px-4 py-3 text-sm font-medium text-center",
  // No forced padding/rounding/typography at all — className supplies 100%
  // of the shape. For controls whose look doesn't match any preset above
  // (icon buttons, underlined text links, carousel arrows, dropdown
  // triggers, …) — still routes through this component for its type/
  // disabled/aria/event-handler plumbing, just with zero visual opinion.
  bare: "",
};

interface ButtonElementOwnProps {
  // Exactly one of these is expected — `to` for navigation, everything else
  // for an in-place <button> (onClick, aria-*, etc. — see the extended
  // ButtonHTMLAttributes below).
  to?: string;
  size?: ButtonSize;
  /**
   * "solid" (default): white text, for a filled background — this
   * component's original/only behavior.
   * "outline": no forced text colour — className supplies the border/text/
   * hover colours entirely (a bordered button, an icon button with its own
   * tint, a plain-colored text link, …).
   */
  variant?: ButtonVariant;
}

// Extends the full native <button> attribute set (aria-*, onMouseEnter,
// data-*, name, value, …) rather than an enumerated prop list, so any
// button anywhere in the app — however specialized — can route through
// this component without a prop-support gap. `type` is narrowed since
// "reset" has no use case here.
type ButtonElementProps = ButtonElementOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    /** Native button `type` — "submit" lets a panel's Save/Create button
     * trigger its enclosing `<form>`'s onSubmit. Ignored when `to` is set. */
    type?: "button" | "submit";
  };

const ButtonElement = ({
  to,
  children,
  className = "",
  size = "md",
  variant = "solid",
  type = "button",
  title,
  ...rest
}: ButtonElementProps) => {
  // `font-body` here — the app sets no global body font, so a button without
  // it renders in the browser default serif.
  const sharedClassName = `inline-block font-body transition-colors ${SIZE_CLASS[size]} ${variant === "solid" ? "text-white" : ""} ${className}`;

  if (to) {
    // Only title is meaningful to carry onto an <a>-based Link here — the
    // rest of `rest` is typed for a native <button> (onClick's event type
    // alone differs from an anchor's), and no `to`-based caller in this app
    // needs more than a plain nav link + an optional tooltip.
    return (
      <Link to={to} className={sharedClassName} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      title={title}
      className={`${sharedClassName} disabled:opacity-50`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default ButtonElement;
