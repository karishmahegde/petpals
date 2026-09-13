// ProtectedRoute.tsx
// Guards dashboard routes — redirects to /login if there is no authenticated session
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../../logic/store/useAuthStore";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    // Carries the attempted destination as a query param (not location.state)
    // — same convention as the adopt-apply flow's own /login?redirect=...
    // navigates (PetDetailsModal, AdoptApply), which Login.tsx already reads.
    // A query param survives a page refresh mid-login, unlike router state.
    const redirectTo = `${location.pathname}${location.search}`;
    return (
      <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
