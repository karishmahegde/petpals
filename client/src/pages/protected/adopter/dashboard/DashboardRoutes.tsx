import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Pets from "./Pets";
import Appointments from "./Appointments";
import Favorites from "./Favorites";
import Applications from "./Applications";
import Visits from "./Visits";
import Profile from "./Profile";
import MatchesLauncher from "./sections/matches/MatchesLauncher";
import NotificationsPage from "../../shared/notifications/NotificationsPage";

// Renders the adopter dashboard section that matches the current /adopter/*
// route (driven by the sidebar nav), plus the floating AI matches button
// shown on every one of them.
const DashboardRoutes = () => (
  <>
    <Routes>
      <Route index element={<Overview />} />
      <Route path="pets" element={<Pets />} />
      <Route path="appointments" element={<Appointments />} />
      <Route path="favorites" element={<Favorites />} />
      <Route path="applications" element={<Applications />} />
      <Route path="visits" element={<Visits />} />
      <Route path="profile" element={<Profile />} />
      {/* Reached from the bell, not the sidebar menu — shared by every role. */}
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="*" element={<Navigate to="/adopter" replace />} />
    </Routes>
    <MatchesLauncher />
  </>
);

export default DashboardRoutes;
