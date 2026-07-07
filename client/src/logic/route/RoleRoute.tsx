// RoleRoute.tsx
// Guards dashboard routes — redirects to /forbidden if the authenticated user's role isn't allowed
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import useAuthStore from "../../logic/store/useAuthStore";

interface RoleRouteProps {
  allowedRoles: string[];
  children: ReactNode;
}

const RoleRoute = ({ allowedRoles, children }: RoleRouteProps) => {
  const role = useAuthStore((state) => state.role);

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
