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
      className={`min-h-36 w-full shrink-0 rounded-2xl p-5 shadow-md ${bg}`}
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

// The row the tiles sit in (a tile fills whatever width it's given).
// Phones: two columns filling the card, the gap matching the card's p-4, so
// the space between tiles equals the space around them; an odd last tile
// keeps that width, centred on its own row. sm and up: a wrapping row of
// 9rem tiles.
export const StatTileRow = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-4 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 max-sm:[&>*:last-child:nth-child(odd)]:w-[calc(50%-0.5rem)] max-sm:[&>*:last-child:nth-child(odd)]:justify-self-center sm:flex sm:flex-wrap sm:gap-5 sm:[&>*]:w-36">
    {children}
  </div>
);

export default StatTile;
