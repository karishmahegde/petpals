// AvailabilityGrid.tsx
// A volunteer's weekly availability as a day × slot grid (Mon–Sun ×
// Morning/Afternoon/Evening). Read-only by default (staff's volunteer
// detail); pass `onToggle` to make each cell a toggle (the volunteer's own
// Availability tab). Content-agnostic beyond the Availability shape, so it
// lives in components/ui.
import ButtonElement from "./ButtonElement";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_SLOTS,
  AVAILABILITY_SLOT_HOURS,
  isAvailable,
  type Availability,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "../../logic/utils/availability";

interface AvailabilityGridProps {
  value: Availability;
  /** Makes every cell a toggle button; omit for a read-only grid. */
  onToggle?: (day: AvailabilityDay, slot: AvailabilitySlot) => void;
  disabled?: boolean;
}

const cellBase =
  "flex h-9 items-center justify-center rounded-md font-body text-xs font-semibold";
const onClass = "bg-teal-dark text-white";
const offClass = "bg-neutral-offwhite text-neutral-gray";

const AvailabilityGrid = ({ value, onToggle, disabled = false }: AvailabilityGridProps) => (
  <div
    className="grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] gap-1.5"
    role="table"
    aria-label="Weekly availability"
  >
    <div role="columnheader" />
    {AVAILABILITY_SLOTS.map((slot) => (
      <div
        key={slot}
        role="columnheader"
        className="pb-1 text-center font-body text-xs font-semibold text-neutral-charcoal"
      >
        {slot}
        <span className="block font-normal text-neutral-gray">
          {AVAILABILITY_SLOT_HOURS[slot]}
        </span>
      </div>
    ))}

    {AVAILABILITY_DAYS.map((day) => (
      <div key={day} role="row" className="contents">
        <div
          role="rowheader"
          className="flex items-center font-body text-xs font-semibold text-neutral-charcoal"
        >
          {day}
        </div>
        {AVAILABILITY_SLOTS.map((slot) => {
          const on = isAvailable(value, day, slot);
          const label = `${day} ${slot}: ${on ? "available" : "unavailable"}`;
          return onToggle ? (
            <ButtonElement
              key={slot}
              size="bare"
              variant="outline"
              aria-pressed={on}
              aria-label={label}
              disabled={disabled}
              onClick={() => onToggle(day, slot)}
              className={`${cellBase} ${on ? onClass : offClass} hover:brightness-95 disabled:opacity-60`}
            >
              {on ? "✓" : ""}
            </ButtonElement>
          ) : (
            <div key={slot} role="cell" aria-label={label} className={`${cellBase} ${on ? onClass : offClass}`}>
              {on ? "✓" : ""}
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

export default AvailabilityGrid;
