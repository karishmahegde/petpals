import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Shelters from "./Shelters";
import Staff from "./Staff";
import Admins from "./Admins";
import AdminProfile from "./AdminProfile";

// Renders the admin dashboard section that matches the current /admin/*
// route (driven by the sidebar nav). Analytics tab lands in a later sprint.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="shelters" element={<Shelters />} />
    <Route path="staff" element={<Staff />} />
    <Route path="admins" element={<Admins />} />
    <Route path="profile" element={<AdminProfile />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
);

export default DashboardRoutes;
