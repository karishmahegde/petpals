import { useState } from "react";
import type { ReactNode } from "react";
import DashboardNavbar from "./DashboardNavbar";
import DashboardSidebar from "./DashboardSidebar";

interface DashboardLayoutProps {
  /** The role's own <DashboardRoutes /> — everything else here is identical
   * across every role's dashboard, so this is the only thing that varies. */
  children: ReactNode;
}

// Shared shell for every role's dashboard (Admin, Adopter, Staff, and any
// future role) — navbar + sidebar + mobile-drawer state. Was duplicated
// verbatim per role until now; DashboardSidebar already reads the current
// role from the auth store itself, so nothing role-specific needs to be
// threaded through here.
const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Dummy - replace with real unread state once the notification system exists.
  const hasNotifications = false;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-offwhite">
      <DashboardNavbar
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((prev) => !prev)}
        hasNotifications={hasNotifications}
      />

      <div className="flex flex-1">
        <DashboardSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
