import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
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
  const [authReady, setAuthReady] = useState(false); //Since the navbar will display user details only if logged in, to improve the UX, we load the UI only after receiving the user details response

  useEffect(() => {
    refreshToken() // Calls authApi.ts function which hits POST /api/v1/auth/refresh-token with
      .then(({ token, user }) => {
        login(user, token, user.role); // calls to populate the Zustand store — restoring the auth session in memory
      })
      .catch(() => {})
      .finally(() => {
        setAuthReady(true); // add this
      });
  }, []); // [] indicates running only on app load, not on rerenders

  if (!authReady) return <div className="min-h-screen bg-rose-light" />; //in between load

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Role-based dashboards — will move to protected layout in a later sprint */}
      <Route path="/adopter" element={<AdopterDashboard />} />
      <Route path="/staff" element={<StaffDashboard />} />
      <Route path="/vet" element={<VetDashboard />} />
      <Route path="/volunteer" element={<VolunteerDashboard />} />
      <Route path="/donor" element={<DonorDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
};

export default App;
