// components/ui/SelectField.tsx
// A single-choice dropdown that matches the catalog's CheckboxDropdown — same
// label row, trigger, and popup panel (FilterControls.tsx's Dropdown), but
// picking an option replaces the value and closes it. Used for the dashboard
// filter/sort dropdowns (Appointments pet filter, Favorites sort, Applications
// status) so a native <select>'s OS-styled option list doesn't show through.
import { useState, type ReactNode } from "react";
import { FaCheck } from "react-icons/fa";
import { Dropdown } from "./pets/FilterControls";

interface SelectFieldOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  /** Emoji or icon node shown before the label. */
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  /** Extra classes on the wrapper (e.g. a max width). */
  className?: string;
}

const SelectField = ({
  label,
  icon,
  value,
  onChange,
  options,
  className = "",
}: SelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  // Treat the first option ("All …") as a placeholder-style value.
  const isPlaceholder = options.length > 0 && value === options[0].value;

  return (
    <div className={className}>
      <Dropdown
        icon={icon}
        label={label}
        triggerText={selected?.label ?? ""}
        isPlaceholder={isPlaceholder}
        open={open}
        onOpenChange={setOpen}
      >
        <ul className="max-h-56 overflow-y-auto">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-offwhite ${
                    active
                      ? "font-semibold text-teal-dark"
                      : "text-neutral-charcoal"
                  }`}
                >
                  {option.label}
                  {active && <FaCheck className="shrink-0 text-xs" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Dropdown>
    </div>
  );
};

export default SelectField;
