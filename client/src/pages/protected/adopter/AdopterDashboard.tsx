import { useState } from "react";
import DashboardNavbar from "../../../components/layout/DashboardNavbar";
import DashboardSidebar from "../../../components/layout/DashboardSidebar";
import AdopterDashboardMain from "./AdopterDashboardMain";

const AdopterDashboard = () => {
  // Sidebar drawer state (mobile). Moves to a shared DashboardLayout once the
  // other role dashboards need it too.
  const [menuOpen, setMenuOpen] = useState(false);

  // Dummy — replace with real unread state once the notification system exists.
  const hasNotifications = false;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-offwhite">
      <DashboardNavbar
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((prev) => !prev)}
        hasNotifications={hasNotifications}
      />

      <div className="flex flex-1">
        <DashboardSidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <main className="min-w-0 flex-1 p-6 md:p-8">
          <AdopterDashboardMain />
        </main>
      </div>
    </div>
  );
};

export default AdopterDashboard;
