import { NavLink } from "react-router-dom";
import { FaRegBell } from "react-icons/fa";
import logoNav from "../../static/assets/images/branding/logoNav.png";

interface DashboardNavbarProps {
  /** Opens/closes the dashboard sidebar (mobile). Owned by the dashboard layout. */
  onMenuToggle?: () => void;
  /** Current sidebar state — drives the hamburger/close icon swap. */
  menuOpen?: boolean;
  /**
   * Whether the adopter has unread notifications. When true the outline bell
   * gets an unread dot; when false it's the plain outline bell. Defaults to
   * false — dummy for now, wired to the real notification system later.
   */
  hasNotifications?: boolean;
}

const DashboardNavbar = ({
  onMenuToggle,
  menuOpen = false,
  hasNotifications = false,
}: DashboardNavbarProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-rose-lightest shadow-lg">
      <div className="flex items-center justify-between px-6 py-5">
        {/* Brand logo → public homepage */}
        <NavLink to="/">
          <img src={logoNav} alt="PetPals" className="h-12 md:h-14 w-auto" />
        </NavLink>

        <div className="flex items-center gap-3 md:gap-4">
          {/* Notification bell */}
          <button
            type="button"
            aria-label={
              hasNotifications ? "Notifications — unread" : "Notifications"
            }
            className="relative text-rose-dark hover:text-teal-dark transition-colors"
          >
            <FaRegBell className="h-6 w-6" />
            {hasNotifications && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-dark ring-2 ring-rose-lightest" />
            )}
          </button>

          {/* Hamburger (mobile) — toggles the dashboard sidebar */}
          <button
            type="button"
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
          </button>
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;
