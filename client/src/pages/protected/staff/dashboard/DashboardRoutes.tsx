import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Pets from "./Pets";
import Applications from "./Applications";
import Profile from "./Profile";
import Transfers from "./Transfers";
import Appointments from "./Appointments";
import Volunteers from "./Volunteers";
import Visits from "./Visits";
import Events from "./Events";
import Donations from "./Donations";
import Team from "./Team";
import IdVerification from "./IdVerification";
import HealthPassport from "./sections/pets/HealthPassport";

// Renders the staff dashboard section that matches the current /staff/*
// route (driven by the sidebar nav in DashboardSidebar.tsx). Most sections
// are placeholders until their own sprint card builds real content — see
// each page file for which one.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="pets" element={<Pets />} />
    <Route path="pets/:petID/health-passport" element={<HealthPassport />} />
    <Route path="transfers" element={<Transfers />} />
    <Route path="appointments" element={<Appointments />} />
    <Route path="applications" element={<Applications />} />
    <Route path="volunteers" element={<Volunteers />} />
    <Route path="visits" element={<Visits />} />
    <Route path="id-verification" element={<IdVerification />} />
    <Route path="events" element={<Events />} />
    <Route path="donations" element={<Donations />} />
    <Route path="team" element={<Team />} />
    <Route path="profile" element={<Profile />} />
    <Route path="*" element={<Navigate to="/staff" replace />} />
  </Routes>
);

export default DashboardRoutes;
