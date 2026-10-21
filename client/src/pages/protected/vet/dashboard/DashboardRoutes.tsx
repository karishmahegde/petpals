import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Appointments from "./Appointments";
import HealthRecords from "./HealthRecords";
import Vaccinations from "./Vaccinations";
import Profile from "./Profile";
import HealthPassport from "../../shared/HealthPassport";
import NotificationsPage from "../../shared/notifications/NotificationsPage";

// Renders the vet dashboard section that matches the current /vet/* route
// (driven by the sidebar nav in DashboardSidebar.tsx).
// them.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="appointments" element={<Appointments />} />
    <Route path="health-records" element={<HealthRecords />} />
    <Route
      path="health-records/:petID/health-passport"
      element={<HealthPassport role="Veterinarian" />}
    />
    <Route path="vaccinations" element={<Vaccinations />} />
    <Route path="profile" element={<Profile />} />
    {/* Reached from the bell, not the sidebar menu — shared by every role. */}
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="*" element={<Navigate to="/vet" replace />} />
  </Routes>
);

export default DashboardRoutes;
