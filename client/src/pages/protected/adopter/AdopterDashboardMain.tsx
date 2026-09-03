import { Routes, Route, Navigate } from "react-router-dom";
import AdopterOverview from "./sections/AdopterOverview";
import AdopterPets from "./sections/AdopterPets";
import AdopterAppointments from "./sections/AdopterAppointments";
import AdopterFavorites from "./sections/AdopterFavorites";
import AdopterApplications from "./sections/AdopterApplications";
import AdopterVisits from "./sections/AdopterVisits";

// Renders the adopter dashboard section that matches the current /adopter/*
// route (driven by the sidebar nav).
const AdopterDashboardMain = () => (
  <Routes>
    <Route index element={<AdopterOverview />} />
    <Route path="pets" element={<AdopterPets />} />
    <Route path="appointments" element={<AdopterAppointments />} />
    <Route path="favorites" element={<AdopterFavorites />} />
    <Route path="applications" element={<AdopterApplications />} />
    <Route path="visits" element={<AdopterVisits />} />
    <Route path="*" element={<Navigate to="/adopter" replace />} />
  </Routes>
);

export default AdopterDashboardMain;
