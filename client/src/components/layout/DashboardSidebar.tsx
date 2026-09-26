import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { IconType } from "react-icons";
import {
  PiHouse,
  PiUsersThree,
  PiDog,
  PiStethoscope,
  PiHeart,
  PiFileText,
  PiBuildings,
  PiShieldCheck,
  PiArrowUpRight,
  PiDotsThreeVertical,
  PiPawPrint,
  PiArrowsClockwise,
  PiHandHeart,
  PiCalendarCheck,
  PiConfettiFill,
  PiHandCoins,
  PiGearSix,
  PiIdentificationBadge,
  PiFirstAidKit,
  PiUserList,
  PiIdentificationCard,
} from "react-icons/pi";
import { FaUserCircle } from "react-icons/fa";
import Avatar from "../ui/Avatar";
import ButtonElement from "../ui/ButtonElement";
import useAuthStore from "../../logic/store/useAuthStore";
import { logout as logoutApi } from "../../logic/api/authApi";
import { getMyStaffProfile } from "../../logic/api/staffApi";

// A flat entry is a single clickable link. A group is a non-clickable
// section header (label + icon) followed by its own links, indented one
// level — a real two-level nav, not just a visual divider. Groups are
// always expanded (no collapse state) since no role's menu is deep enough
// yet to need that.
interface NavLinkItem {
  type: "link";
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
  /** Staff only: shown just to the shelter's manager. */
  managerOnly?: boolean;
}

interface NavGroupItem {
  type: "group";
  label: string;
  icon: IconType;
  items: NavLinkItem[];
}

type NavEntry = NavLinkItem | NavGroupItem;

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
const ROLE_NAV: Record<string, NavEntry[]> = {
  Admin: [
    { type: "link", label: "Overview", to: "/admin", icon: PiHouse, end: true },
    {
      type: "link",
      label: "Shelters",
      to: "/admin/shelters",
      icon: PiBuildings,
    },
    { type: "link", label: "Staff", to: "/admin/staff", icon: PiUsersThree },
    { type: "link", label: "Admins", to: "/admin/admins", icon: PiShieldCheck },
    {
      type: "link",
      label: "ID Verification",
      to: "/admin/id-verification",
      icon: PiIdentificationCard,
    },
  ],
  Adopter: [
    {
      type: "link",
      label: "Overview",
      to: "/adopter",
      icon: PiHouse,
      end: true,
    },
    { type: "link", label: "My Pets", to: "/adopter/pets", icon: PiDog },
    {
      type: "link",
      label: "Appointments",
      to: "/adopter/appointments",
      icon: PiStethoscope,
    },
    {
      type: "link",
      label: "Favorites",
      to: "/adopter/favorites",
      icon: PiHeart,
    },
    {
      type: "link",
      label: "Applications",
      to: "/adopter/applications",
      icon: PiFileText,
    },
    { type: "link", label: "Visits", to: "/adopter/visits", icon: PiBuildings },
  ],
  // Full information architecture scaffolded now per product direction — most
  // sub-pages are placeholders until their own sprint builds real content
  // (see each page's own file). Only "Overview" here doubles as the index
  // route's label; it is distinct from the constant "Home" link renderNav
  // always appends last (that one exits the dashboard to the public site).
  Staff: [
    { type: "link", label: "Overview", to: "/staff", icon: PiHouse, end: true },
    {
      type: "group",
      label: "Animals",
      icon: PiPawPrint,
      items: [
        { type: "link", label: "Pets", to: "/staff/pets", icon: PiDog },
        {
          type: "link",
          label: "Transfers",
          to: "/staff/transfers",
          icon: PiArrowsClockwise,
        },
        {
          type: "link",
          label: "Appointments",
          to: "/staff/appointments",
          icon: PiStethoscope,
        },
      ],
    },
    // The adoption pipeline, in the order staff work it.
    {
      type: "group",
      label: "Adoptions",
      icon: PiHeart,
      items: [
        {
          type: "link",
          label: "Applications",
          to: "/staff/applications",
          icon: PiFileText,
        },
        {
          type: "link",
          label: "Visits",
          to: "/staff/visits",
          icon: PiCalendarCheck,
        },
        {
          type: "link",
          label: "Adopters",
          to: "/staff/adopters",
          icon: PiUserList,
        },
      ],
    },
    {
      type: "group",
      label: "Community",
      icon: PiUsersThree,
      items: [
        {
          type: "link",
          label: "Volunteers",
          to: "/staff/volunteers",
          icon: PiHandHeart,
        },
        {
          type: "link",
          label: "Events",
          to: "/staff/events",
          icon: PiConfettiFill,
        },
        {
          type: "link",
          label: "Donations",
          to: "/staff/donations",
          icon: PiHandCoins,
        },
      ],
    },
    // Who may act at this shelter. ID Verification is open to all staff
    // (adopter/volunteer IDs); Staff and Vets are manager-only, and so are
    // staff/vet IDs within ID Verification (enforced server-side).
    {
      type: "group",
      label: "Management",
      icon: PiGearSix,
      items: [
        {
          type: "link",
          label: "Staff",
          to: "/staff/team",
          icon: PiIdentificationBadge,
          managerOnly: true,
        },
        {
          type: "link",
          label: "Vets",
          to: "/staff/vets",
          icon: PiFirstAidKit,
          managerOnly: true,
        },
        {
          type: "link",
          label: "ID Verification",
          to: "/staff/id-verification",
          icon: PiIdentificationCard,
        },
      ],
    },
  ],
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-4 px-6 py-3.5 font-light font-body text-[15px] transition-colors ${
    isActive
      ? "bg-rose-light text-neutral-dark"
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

  // Staff: whether this user manages their shelter (same cached query as the
  // staff pages) — hides managerOnly links otherwise (and a group left with
  // no links).
  const { data: staffProfile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
    enabled: role === "Staff",
  });
  const isManager = staffProfile?.staffDesignation === "Manager";

  const isVisible = (link: NavLinkItem) => !link.managerOnly || isManager;
  const items: NavEntry[] =
    role && ROLE_NAV[role]
      ? ROLE_NAV[role].flatMap((entry): NavEntry[] => {
          if (entry.type === "link") return isVisible(entry) ? [entry] : [];
          const links = entry.items.filter(isVisible);
          return links.length > 0 ? [{ ...entry, items: links }] : [];
        })
      : [
          {
            type: "link",
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
      // Leave the protected page before clearing the session — otherwise
      // ProtectedRoute sees the token vanish first and redirects to
      // /login?redirect=<this page>, which the next login would follow.
      navigate("/");
      storeLogout();
      setAcctOpen(false);
      onClose?.();
    }
  };

  const renderLink = (
    { label, to, icon: Icon, end }: NavLinkItem,
    indented = false,
  ) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `${linkClass({ isActive })} ${indented ? "pl-11" : ""}`
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );

  const renderNav = () => (
    <>
      {items.map((entry) =>
        entry.type === "group" ? (
          <div key={entry.label}>
            {/* Section header — not a link, just groups the items below it. */}
            <div className="flex items-center gap-4 px-6 pb-1 pt-4 font-body text-xs font-semibold uppercase tracking-wide text-gold-md">
              <entry.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{entry.label}</span>
            </div>
            {entry.items.map((item) => renderLink(item, true))}
          </div>
        ) : (
          renderLink(entry)
        ),
      )}

      {/* Constant last item — leaves the dashboard for the public site. */}
      <Link
        to="/"
        onClick={onClose}
        className="flex items-center font-light gap-4 px-6 py-3.5 font-body text-[15px] text-white transition-colors hover:bg-white/10"
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
        <ButtonElement
          onClick={() => setAcctOpen((prev) => !prev)}
          aria-label="Account menu"
          aria-expanded={acctOpen}
          size="bare"
          variant="outline"
          className="shrink-0 text-neutral-lightgray transition-colors hover:text-white"
        >
          <PiDotsThreeVertical className="h-5 w-5" />
        </ButtonElement>
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
          <ButtonElement
            onClick={handleLogout}
            size="bare"
            variant="outline"
            className="block w-full border-t border-neutral-offwhite px-4 py-3 text-left font-body text-sm text-rose-dark transition-colors hover:bg-gold-light"
          >
            Log out
          </ButtonElement>
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
