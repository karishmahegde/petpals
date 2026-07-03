import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import logoNav from "../../assets/images/branding/logoNav.png";
import useAuthStore from "../../store/useAuthStore";
import { logout as logoutApi } from "../../api/authApi";

const navLinks = [
  { label: "home", to: "/" },
  { label: "about", to: "/about" },
  { label: "volunteer", to: "/volunteerinfo" },
  { label: "adopt", to: "/adopt" },
];

// DB role enum → client route
const ROLE_ROUTES: Record<string, string> = {
  Admin: "/admin",
  Adopter: "/adopter",
  Staff: "/staff",
  Veterinarian: "/vet",
  Volunteer: "/volunteer",
  Donor: "/donor",
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `font-body font-normal text-sm px-5 py-1.5 rounded-lg transition-colors ${
    isActive
      ? "bg-teal text-rose-dark font-bold"
      : "text-neutral-dark hover:text-teal-dark"
  }`;

const Navbar = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const storeLogout = useAuthStore((state) => state.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const dashboardRoute = role
    ? (ROLE_ROUTES[role] ?? `/${role.toLowerCase()}`)
    : "/";

  // Close desktop dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      storeLogout();
      navigate("/");
      setMenuOpen(false);
      setDropdownOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-rose-lightest shadow-sm">
      <div className="flex items-center justify-between px-6 py-5">
        {/* Brand logo */}
        <NavLink to="/">
          <img src={logoNav} alt="PetPals" className="h-12 md:h-14 w-auto" />
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-16">
          {navLinks.map(({ label, to }) => (
            <NavLink key={to} to={to} end={to === "/"} className={linkClass}>
              {label}
            </NavLink>
          ))}

          {user ? (
            // Logged-in: user chip + dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 font-body text-sm font-medium text-neutral-dark bg-gold-md px-4 py-2 rounded-xl hover:brightness-95 transition-colors"
              >
                <FaUserCircle className="h-5 w-5" />
                {firstName}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19 9-7 7-7-7"
                  />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-neutral-offwhite overflow-hidden">
                  <button
                    onClick={() => {
                      navigate(dashboardRoute);
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 font-body text-sm text-neutral-dark hover:bg-gold-light transition-colors"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 font-body text-sm text-rose-dark hover:bg-gold-light transition-colors border-t border-neutral-offwhite"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Logged-out: login button
            <NavLink
              to="/login"
              className="font-body text-sm font-medium bg-rose-dark text-white px-5 py-2 rounded-xl hover:brightness-90 transition-colors"
            >
              login
            </NavLink>
          )}
        </div>

        {/* Hamburger button (mobile) */}
        <div className="md:hidden flex items-center gap-2">
          <button
            className="text-rose-dark"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-8"
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-neutral-charcoal text-white px-6 py-4 flex flex-col gap-4">
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `font-body font-light text-sm py-1.5 ${
                  isActive ? "text-teal-md font-semibold" : "text-white"
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          {user ? (
            // Logged-in: dashboard + logout with distinct background
            <div className="flex flex-col gap-2 pt-3 border-t border-neutral-gray/40">
              <div className="flex gap-1.5 p-2 rounded-lg text-white">
                <FaUserCircle className="h-5 w-5" />
                <span className="font-body text-sm font-medium">
                  {firstName}
                </span>
              </div>
              <button
                onClick={() => {
                  navigate(dashboardRoute);
                  setMenuOpen(false);
                }}
                className="text-left font-body text-sm font-medium text-white bg-gold-md/80 px-4 py-2.5 rounded-lg"
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="text-left font-body text-sm font-medium text-white bg-rose-dark/80 px-4 py-2.5 rounded-lg"
              >
                Logout
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="font-body text-sm font-medium bg-rose-md text-white px-5 py-2 rounded-2xl text-center hover:bg-rose-dark transition-colors"
            >
              login
            </NavLink>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
