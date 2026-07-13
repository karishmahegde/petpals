import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import ProtectedRoute from "./logic/route/ProtectedRoute";
import RoleRoute from "./logic/route/RoleRoute";
import Home from "./pages/public/home/Home";
import Login from "./pages/public/auth/Login";
import Register from "./pages/public/auth/Register";
import Adopt from "./pages/public/adopt/Adopt";
import Forbidden from "./pages/errors/Forbidden";
import NotFound from "./pages/errors/NotFound";
import AdopterDashboard from "./pages/protected/adopter/AdopterDashboard";
import StaffDashboard from "./pages/protected/staff/StaffDashboard";
import VetDashboard from "./pages/protected/vet/VetDashboard";
import VolunteerDashboard from "./pages/protected/volunteer/VolunteerDashboard";
import DonorDashboard from "./pages/protected/donor/DonorDashboard";
import AdminDashboard from "./pages/protected/admin/AdminDashboard";
import { refreshToken } from "./logic/api/authApi";
import useAuthStore from "./logic/store/useAuthStore";

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
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Role-based dashboards — guarded by ProtectedRoute (authenticated) + RoleRoute (correct role) */}
      <Route
        path="/adopter"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Adopter"]}>
              <AdopterDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Staff"]}>
              <StaffDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vet"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Veterinarian"]}>
              <VetDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/volunteer"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Volunteer"]}>
              <VolunteerDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/donor"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Donor"]}>
              <DonorDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["Admin"]}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
