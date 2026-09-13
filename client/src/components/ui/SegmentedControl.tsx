// components/ui/SegmentedControl.tsx
// Pill-style single-choice control — selected = white bg + rose border,
// unselected = rose-light fill. Used throughout the onboarding wizard
// (Housing Type, Own/Rent) and reusable as-is for the adoption application
// form's Adopter Type (Adopt/Foster) later.
interface SegmentedOption {
  value: string;
  label: string;
  icon?: string; // optional emoji, rendered before the label
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

const SegmentedControl = ({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps) => (
  <div
    className={`flex w-full overflow-hidden rounded-xl border border-rose-light ${className}`}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={selected}
          className={`flex-1 px-4 py-2.5 font-body text-sm font-medium transition-colors ${
            selected
              ? "bg-rose text-white"
              : "bg-rose-lightest text-neutral-charcoal hover:brightness-95"
          }`}
        >
          {option.icon && <span className="mr-1.5">{option.icon}</span>}
          {option.label}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
