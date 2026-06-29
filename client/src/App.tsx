import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import NotFound from "./pages/NotFound";
import AdopterDashboard from "./pages/adopter/AdopterDashboard";
import StaffDashboard from "./pages/staff/StaffDashboard";
import VetDashboard from "./pages/vet/VetDashboard";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import DonorDashboard from "./pages/donor/DonorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { refreshToken } from "./api/authApi";
import useAuthStore from "./store/useAuthStore";

// What it does: The root component. Defines all the routes — which URL path renders which page component.
const App = () => {
  const login = useAuthStore((state) => state.login); // Pulls the login action out of your Zustand store so you can call it in this component

  useEffect(() => {
    refreshToken() // Calls authApi.ts function which hits POST /api/v1/auth/refresh-token with
      .then(({ token, user }) => {
        login(user, token, user.role); // calls to populate the Zustand store — restoring the auth session in memory
      })
      .catch(() => {});
  }, []); // [] indicates running only on app load, not on rerenders

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
