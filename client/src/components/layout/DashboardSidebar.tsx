import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  PiHouse,
  PiDog,
  PiStethoscope,
  PiHeart,
  PiFileText,
  PiBuildings,
  PiArrowUpRight,
  PiDotsThreeVertical,
} from "react-icons/pi";
import { FaUserCircle } from "react-icons/fa";
import Avatar from "../ui/Avatar";
import useAuthStore from "../../logic/store/useAuthStore";
import { logout as logoutApi } from "../../logic/api/authApi";

interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
}

// DB role enum → client dashboard route (fallback nav when a role has no
// dedicated item set yet).
const ROLE_HOME: Record<string, string> = {
  Admin: "/admin",
  Adopter: "/adopter",
  Staff: "/staff",
  Veterinarian: "/vet",
  Volunteer: "/volunteer",
  Donor: "/donor",
};

// Role-specific navigation. The constant "Main website" link is appended for
// every role in renderNav — it is always the last item.
const ROLE_NAV: Record<string, NavItem[]> = {
  Adopter: [
    { label: "Overview", to: "/adopter", icon: PiHouse, end: true },
    { label: "My Pets", to: "/adopter/pets", icon: PiDog },
    { label: "Appointments", to: "/adopter/appointments", icon: PiStethoscope },
    { label: "Favorites", to: "/adopter/favorites", icon: PiHeart },
    { label: "Applications", to: "/adopter/applications", icon: PiFileText },
    { label: "Visits", to: "/adopter/visits", icon: PiBuildings },
  ],
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-4 px-6 py-3.5 font-body text-[15px] transition-colors ${
    isActive
      ? "bg-rose-light font-semibold text-neutral-dark"
      : "text-white hover:bg-white/10"
  }`;

interface DashboardSidebarProps {
  /** Mobile drawer open state — desktop ignores this and is always visible. */
  open?: boolean;
  /** Close the mobile drawer (backdrop tap, nav click, close button). */
  onClose?: () => void;
  /** Role override; falls back to the logged-in user's role from the store. */
  role?: string;
}

const DashboardSidebar = ({
  open = false,
  onClose,
  role: roleProp,
}: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const storeRole = useAuthStore((state) => state.role);
  const storeLogout = useAuthStore((state) => state.logout);
  const role = roleProp ?? storeRole ?? undefined;

  const [acctOpen, setAcctOpen] = useState(false);

  const items: NavItem[] =
    role && ROLE_NAV[role]
      ? ROLE_NAV[role]
      : [
          {
            label: "Home",
            to: role ? (ROLE_HOME[role] ?? "/") : "/",
            icon: PiHouse,
            end: true,
          },
        ];

  const firstName = user?.name?.split(" ")[0] ?? "";
  const profilePath =
    role && ROLE_HOME[role] ? `${ROLE_HOME[role]}/profile` : "/";

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close the account popover on outside click (covers both rendered copies).
  useEffect(() => {
    if (!acctOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-account-menu]")) {
        setAcctOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [acctOpen]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      storeLogout();
      setAcctOpen(false);
      onClose?.();
      navigate("/");
    }
  };

  const renderNav = () => (
    <>
      {items.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onClose}
          className={linkClass}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}

      {/* Constant last item — leaves the dashboard for the public site. */}
      <Link
        to="/"
        onClick={onClose}
        className="flex items-center gap-4 px-6 py-3.5 font-body text-[15px] text-white transition-colors hover:bg-white/10"
      >
        <PiArrowUpRight className="h-5 w-5 shrink-0" aria-hidden />
        <span>Home</span>
      </Link>
    </>
  );

  const renderAccount = () => (
    <div
      data-account-menu
      className="relative border-t border-neutral-gray/40 px-5 py-4"
    >
      <div className="flex items-center gap-3">
        {user?.avatarSeed ? (
          <Avatar
            seed={user.avatarSeed}
            size={36}
            className="h-9 w-9 shrink-0 rounded-full border border-white/20"
          />
        ) : (
          <FaUserCircle className="h-9 w-9 shrink-0 text-rose-light" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-sm font-semibold text-white">
            {firstName || "Account"}
          </p>
          {role && (
            <p className="font-body text-xs text-neutral-lightgray">{role}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAcctOpen((prev) => !prev)}
          aria-label="Account menu"
          aria-expanded={acctOpen}
          className="shrink-0 text-neutral-lightgray transition-colors hover:text-white"
        >
          <PiDotsThreeVertical className="h-5 w-5" />
        </button>
      </div>

      {acctOpen && (
        <div className="absolute inset-x-5 bottom-full mb-2 overflow-hidden rounded-xl bg-white shadow-lg">
          <Link
            to={profilePath}
            onClick={() => {
              setAcctOpen(false);
              onClose?.();
            }}
            className="block w-full px-4 py-3 text-left font-body text-sm text-neutral-dark transition-colors hover:bg-gold-light"
          >
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="block w-full border-t border-neutral-offwhite px-4 py-3 text-left font-body text-sm text-rose-dark transition-colors hover:bg-gold-light"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop — sticky column, stays put while the content area scrolls.
          top-24 / 6rem matches the DashboardNavbar height. */}
      <aside className="hidden w-72 shrink-0 flex-col self-start bg-neutral-charcoal md:sticky md:top-24 md:flex md:h-[calc(100vh-6rem)]">
        <nav className="flex-1 overflow-y-auto pb-4">{renderNav()}</nav>
        {renderAccount()}
      </aside>

      {/* Mobile — drawer opened from the top-nav hamburger. Styling mirrors the
          public site's mobile menu (neutral-charcoal panel, white links). */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col bg-neutral-charcoal text-white shadow-xl transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <span className="font-display text-lg">Menu</span>
        </div>
        <nav className="flex-1 overflow-y-auto">{renderNav()}</nav>
        {renderAccount()}
      </div>
    </>
  );
};

export default DashboardSidebar;
