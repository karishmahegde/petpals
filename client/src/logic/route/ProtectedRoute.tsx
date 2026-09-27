// ProtectedRoute.tsx
// Guards dashboard routes — redirects to a login page if there is no
// authenticated session: the worker portal's for worker dashboards (/staff,
// /admin, /vet), the public /login for everything else.
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../../logic/store/useAuthStore";
import { loginPathForPage } from "./resolveDestination";

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
    // WorkerLogin.tsx reads the same param.
    const redirectTo = `${location.pathname}${location.search}`;
    const loginPath = loginPathForPage(location.pathname);
    return (
      <Navigate
        to={`${loginPath}?redirect=${encodeURIComponent(redirectTo)}`}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
