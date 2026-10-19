import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Shelters from "./Shelters";
import Staff from "./Staff";
import Admins from "./Admins";
import IdVerification from "./IdVerification";
import Profile from "./Profile";
import NotificationsPage from "../../shared/notifications/NotificationsPage";

// Renders the admin dashboard section that matches the current /admin/*
// route (driven by the sidebar nav). Analytics tab lands in a later sprint.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="shelters" element={<Shelters />} />
    <Route path="staff" element={<Staff />} />
    <Route path="admins" element={<Admins />} />
    <Route path="id-verification" element={<IdVerification />} />
    <Route path="profile" element={<Profile />} />
    {/* Reached from the bell, not the sidebar menu — shared by every role. */}
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
);

export default DashboardRoutes;
