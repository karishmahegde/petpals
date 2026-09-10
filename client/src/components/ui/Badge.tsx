// components/ui/Badge.tsx
// The one non-interactive status/attribute pill used across the app — a rounded
// chip with a text label and a colour drawn from the design tokens. Callers
// pass a `tone` (and `variant` for the bordered look used by the compatibility
// chips); `className` is an escape hatch for layout tweaks (e.g. `shrink-0`).
//
// This is NOT the removable filter chip — that's `Pill` in
// components/ui/pets/FilterControls.tsx, which carries an X button and its own
// filter-category colours.
import type { ReactNode } from "react";

export type BadgeTone =
  | "gold"
  | "green"
  | "teal"
  | "rose"
  | "gray"
  | "neutral";

interface BadgeProps {
  children: ReactNode;
  /** Colour role. Defaults to "neutral" (muted grey). */
  tone?: BadgeTone;
  /** "solid" (filled) or "outline" (bordered, softer fill). Default "solid". */
  variant?: "solid" | "outline";
  /** Layout-only overrides, e.g. "shrink-0" or a block/width for a placeholder. */
  className?: string;
}

const SOLID: Record<BadgeTone, string> = {
  gold: "bg-gold-md text-white",
  green: "bg-green text-white",
  teal: "bg-teal-light text-teal-dark",
  rose: "bg-rose-md text-white",
  gray: "bg-neutral-gray text-white",
  neutral: "bg-neutral-lightgray text-neutral-charcoal",
};

const OUTLINE: Record<BadgeTone, string> = {
  gold: "border border-gold-md bg-gold-light text-neutral-charcoal",
  green: "border border-green bg-green/10 text-green",
  teal: "border border-teal-md bg-teal-light text-teal-dark",
  rose: "border border-rose-md bg-rose-light text-rose-dark",
  gray: "border border-neutral-gray bg-neutral-lightgray text-neutral-charcoal",
  neutral:
    "border border-neutral-lightgray bg-neutral-offwhite text-neutral-charcoal",
};

const Badge = ({
  children,
  tone = "neutral",
  variant = "solid",
  className = "",
}: BadgeProps) => (
  <span
    className={`inline-block rounded-full px-3 py-1 font-body text-xs font-medium ${
      (variant === "outline" ? OUTLINE : SOLID)[tone]
    } ${className}`}
  >
    {children}
  </span>
);

export default Badge;
