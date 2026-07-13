// components/ui/ButtonElement.tsx
import { Link } from "react-router-dom";

interface ButtonElementProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

const ButtonElement = ({ to, children, className = "" }: ButtonElementProps) => (
  <Link
    to={to}
    className={`my-5 inline-block rounded-md px-6 py-2 text-white transition ${className}`}
  >
    {children}
  </Link>
);

export default ButtonElement;
