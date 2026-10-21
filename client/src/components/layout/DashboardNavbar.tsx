import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import logoNav from "../../static/assets/images/branding/logoNav.png";
import ButtonElement from "../ui/ButtonElement";

interface DashboardNavbarProps {
  /** Opens/closes the dashboard sidebar (mobile). Owned by the dashboard layout. */
  onMenuToggle?: () => void;
  /** Current sidebar state — drives the hamburger/close icon swap. */
  menuOpen?: boolean;
  /**
   * The notification bell (and its dropdown), rendered by the dashboard
   * layout — it talks to the notifications API, which this content-agnostic
   * navbar doesn't.
   */
  notificationBell?: ReactNode;
}

const DashboardNavbar = ({
  onMenuToggle,
  menuOpen = false,
  notificationBell,
}: DashboardNavbarProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-rose-lightest shadow-lg">
      <div className="flex items-center justify-between px-6 py-5">
        {/* Brand logo → public homepage */}
        <NavLink to="/">
          <img src={logoNav} alt="PetPals" className="h-12 md:h-14 w-auto" />
        </NavLink>

        <div className="flex items-center gap-3 md:gap-4">
          {notificationBell}

          {/* Hamburger (mobile) — toggles the dashboard sidebar */}
          <ButtonElement
            size="bare"
            variant="outline"
            className="md:hidden text-rose-dark"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </ButtonElement>
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;
