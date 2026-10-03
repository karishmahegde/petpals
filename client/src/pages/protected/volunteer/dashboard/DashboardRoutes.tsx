import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Tasks from "./Tasks";
import Events from "./Events";
import Appointments from "./Appointments";
import Availability from "./Availability";
import Profile from "./Profile";

// Renders the volunteer dashboard section that matches the current
// /volunteer/* route (driven by the sidebar nav in DashboardSidebar.tsx).
// Every tab but Overview is a placeholder until its own Sprint 7 card — see
// each page file.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="tasks" element={<Tasks />} />
    <Route path="events" element={<Events />} />
    <Route path="appointments" element={<Appointments />} />
    <Route path="availability" element={<Availability />} />
    <Route path="profile" element={<Profile />} />
    <Route path="*" element={<Navigate to="/volunteer" replace />} />
  </Routes>
);

export default DashboardRoutes;
