import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";

export interface FilterOption {
  value: string | number;
  label: string;
}

export const Dropdown = ({
  icon,
  label,
  triggerText,
  isPlaceholder,
  children,
  open: openProp,
  onOpenChange,
}: {
  icon: React.ReactNode;
  label: string;
  triggerText: string;
  isPlaceholder?: boolean;
  children: React.ReactNode;
  // Uncontrolled by default (internal state). Pass both `open` and
  // `onOpenChange` to control it externally — e.g. to auto-close it in
  // response to an action taken inside `children`.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-charcoal">
        {icon}
        {label}
      </label>

      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 text-sm text-neutral-charcoal"
        >
          <span className={isPlaceholder ? "italic text-neutral-gray" : ""}>
            {triggerText}
          </span>
          <FaChevronDown className="text-xs text-neutral-gray" />
        </button>

        {open && (
          <div className="absolute left-0 z-10 mt-1 w-full min-w-[12rem] rounded-md border border-neutral-lightgray bg-white p-2 shadow-lg">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export const CheckboxDropdown = ({
  icon,
  label,
  placeholder,
  options,
  selectedValues,
  onToggle,
  disabled,
  disabledMessage,
  nearbyValues,
  onToggleNearby,
  nearbyBadgeLabel,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  options: FilterOption[];
  selectedValues: (string | number)[];
  onToggle: (value: string | number) => void;
  disabled?: boolean;
  disabledMessage?: string;
  // Options present here render checked (like selectedValues) but with
  // distinct styling and route their toggle through onToggleNearby instead
  // of onToggle — used to visually distinguish shelters surfaced by a
  // nearby-location search from manually-picked ones.
  nearbyValues?: (string | number)[];
  onToggleNearby?: (value: string | number) => void;
  nearbyBadgeLabel?: string;
}) => {
  const count = selectedValues.length;

  return (
    <Dropdown
      icon={icon}
      label={label}
      triggerText={count === 0 ? placeholder : `${count} selected`}
      isPlaceholder={count === 0}
    >
      {disabled ? (
        <p className="p-2 text-xs italic text-neutral-gray">
          {disabledMessage}
        </p>
      ) : options.length === 0 ? (
        <p className="p-2 text-xs italic text-neutral-gray">
          No options available.
        </p>
      ) : (
        <ul className="max-h-56 overflow-y-auto">
          {options.map((option) => {
            const isNearby = nearbyValues?.includes(option.value) ?? false;
            const isChecked = isNearby || selectedValues.includes(option.value);
            return (
              <li key={option.value}>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-charcoal hover:bg-neutral-offwhite">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      isNearby
                        ? onToggleNearby?.(option.value)
                        : onToggle(option.value)
                    }
                    className={isNearby ? "accent-gold-dark" : "accent-teal-dark"}
                  />
                  {option.label}
                  {isNearby && nearbyBadgeLabel && (
                    <span className="ml-auto rounded-full bg-gold-light px-1.5 py-0.5 text-[10px] font-semibold text-gold-dark">
                      {nearbyBadgeLabel}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Dropdown>
  );
};

const PILL_STYLES = {
  species: "border-teal-md bg-teal-light text-teal-dark",
  breed: "border-rose-md bg-rose-light text-rose-dark",
  size: "border-gold-md bg-gold-light text-neutral-charcoal",
  age: "border-neutral-lightgray bg-neutral-offwhite text-neutral-charcoal",
  shelter: "border-teal-md bg-teal-light text-teal-dark",
  location: "border-gold-md bg-gold-light text-neutral-charcoal",
};

export const Pill = ({
  label,
  variant,
  onRemove,
}: {
  label: string;
  variant: keyof typeof PILL_STYLES;
  onRemove: () => void;
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs italic ${PILL_STYLES[variant]}`}
  >
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="not-italic opacity-70 hover:opacity-100"
    >
      <FaTimes className="text-[10px]" />
    </button>
  </span>
);
