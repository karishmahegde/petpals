import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Appointments from "./Appointments";
import HealthRecords from "./HealthRecords";
import Vaccinations from "./Vaccinations";
import Profile from "./Profile";
import HealthPassport from "../../shared/HealthPassport";

// Renders the vet dashboard section that matches the current /vet/* route
// (driven by the sidebar nav in DashboardSidebar.tsx). Health Records,
// Vaccinations and Profile are placeholders until their own cards build
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
    <Route path="*" element={<Navigate to="/vet" replace />} />
  </Routes>
);

export default DashboardRoutes;
