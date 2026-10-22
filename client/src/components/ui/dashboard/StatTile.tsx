// components/ui/StatTile.tsx
// One colored square in a dashboard's stat-tile row — icon, value, label.
// Role-agnostic: each role's Overview page supplies its own icons, values,
// labels, and colors, so this same component drives the equivalent row on
// every dashboard (Staff, Vet, Volunteer, Donor, …), not just Adopter's.
import { ReactNode } from "react";

export type StatTileColor = "gold" | "teal" | "rose" | "green";

interface StatTileProps {
  icon: ReactNode;
  /** Omit for a label-only tile (e.g. the vet Overview's shelter tile). */
  value?: string | number;
  label: string;
  color: StatTileColor;
}

const COLOR_STYLES: Record<StatTileColor, { bg: string; icon: string }> = {
  gold: { bg: "bg-gold-lightest", icon: "text-gold-md" },
  teal: { bg: "bg-teal-light", icon: "text-teal-dark" },
  rose: { bg: "bg-rose-light", icon: "text-rose-dark" },
  green: { bg: "bg-green/15", icon: "text-green" },
};

const StatTile = ({ icon, value, label, color }: StatTileProps) => {
  const { bg, icon: iconColor } = COLOR_STYLES[color];

  return (
    <div
      className={`min-h-36 w-36 shrink-0 rounded-2xl p-5 shadow-md ${bg}`}
    >
      <div className={`mb-6 text-3xl ${iconColor}`} aria-hidden>
        {icon}
      </div>
      {value !== undefined && (
        <p className="font-display text-2xl font-bold text-neutral-dark">
          {value}
        </p>
      )}
      <p className="font-body text-sm leading-tight text-neutral-charcoal">
        {label}
      </p>
    </div>
  );
};

// The row the tiles sit in. Phones: two tile-wide columns centred in the
// card (with plain 1fr columns the fixed-width tiles hug the left of each),
// and an odd last tile centred on its own row. sm and up: one wrapping row.
export const StatTileRow = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-[repeat(2,9rem)] justify-center gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:justify-self-center sm:flex sm:flex-wrap sm:justify-start sm:gap-5">
    {children}
  </div>
);

export default StatTile;
