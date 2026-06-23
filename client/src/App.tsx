import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import NotFound from "./pages/NotFound";
import AdopterDashboard from "./pages/adopter/AdopterDashboard";
import StaffDashboard from "./pages/staff/StaffDashboard";
import VetDashboard from "./pages/vet/VetDashboard";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import DonorDashboard from "./pages/donor/DonorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

// What it does: The root component. Defines all the routes — which URL path renders which page component.
// Routes are uncommented as each sprint is implemented
const App = () => {
  return (
    <Routes>
      <Route element={<Navbar />}>
        {/* Adopter */}
        <Route path="/adopter" element={<AdopterDashboard />} />

        {/* Staff */}
        <Route path="/staff" element={<StaffDashboard />} />

        {/* Vet */}
        <Route path="/vet" element={<VetDashboard />} />

        {/* Volunteer */}
        <Route path="/volunteer" element={<VolunteerDashboard />} />

        {/* Donor */}
        <Route path="/donor" element={<DonorDashboard />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
