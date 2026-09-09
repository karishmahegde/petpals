// components/ui/ButtonElement.tsx
import { Link } from "react-router-dom";

type ButtonSize = "md" | "sm";

// Colour comes from `className` (e.g. "bg-teal-dark hover:bg-gold-dark").
const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "my-5 rounded-md px-6 py-2", // default page CTA
  sm: "rounded-lg px-4 py-2 font-body text-xs font-light", // compact, e.g. a dashboard row action
};

interface ButtonElementProps {
  // Exactly one of these is expected — `to` for navigation, `onClick` for
  // an in-place action (e.g. a conditional check before navigating).
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  size?: ButtonSize;
  /** Button variant only — dims and blocks clicks. */
  disabled?: boolean;
}

const ButtonElement = ({
  to,
  onClick,
  children,
  className = "",
  size = "md",
  disabled = false,
}: ButtonElementProps) => {
  const sharedClassName = `inline-block text-white transition ${SIZE_CLASS[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={sharedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${sharedClassName} disabled:opacity-50`}
    >
      {children}
    </button>
  );
};

export default ButtonElement;
