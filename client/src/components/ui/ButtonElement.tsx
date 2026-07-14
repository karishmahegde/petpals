// components/ui/ButtonElement.tsx
import { Link } from "react-router-dom";

interface ButtonElementProps {
  // Exactly one of these is expected — `to` for navigation, `onClick` for
  // an in-place action (e.g. a conditional check before navigating).
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

const ButtonElement = ({
  to,
  onClick,
  children,
  className = "",
}: ButtonElementProps) => {
  const sharedClassName = `my-5 inline-block rounded-md px-6 py-2 text-white transition ${className}`;

  if (to) {
    return (
      <Link to={to} className={sharedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={sharedClassName}>
      {children}
    </button>
  );
};

export default ButtonElement;
