import { Routes, Route, Navigate } from "react-router-dom";
import Overview from "./Overview";
import Donate from "./Donate";
import DonateConfirmation from "./DonateConfirmation";
import History from "./History";
import Profile from "./Profile";

// Renders the donor dashboard section that matches the current /donor/*
// route (driven by the sidebar nav in DashboardSidebar.tsx). Donation
// History and Profile are placeholders until their own Sprint 7 card.
const DashboardRoutes = () => (
  <Routes>
    <Route index element={<Overview />} />
    <Route path="donate" element={<Donate />} />
    {/* Stripe's success_url — see DonateConfirmation. */}
    <Route path="donate/confirmation" element={<DonateConfirmation />} />
    <Route path="history" element={<History />} />
    <Route path="profile" element={<Profile />} />
    <Route path="*" element={<Navigate to="/donor" replace />} />
  </Routes>
);

export default DashboardRoutes;
