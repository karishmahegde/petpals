// The route guards: ProtectedRoute sends a signed-out visitor to the right
// login page with ?redirect= back to where they were going; RoleRoute sends
// a signed-in user of the wrong role to /forbidden.
import { describe, expect, test } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import { renderWithProviders } from "../../test/render";
import useAuthStore from "../store/useAuthStore";

const DASHBOARDS: [string, string][] = [
  ["/adopter/*", "Adopter"],
  ["/staff/*", "Staff"],
  ["/admin/*", "Admin"],
  ["/vet/*", "Veterinarian"],
  ["/volunteer/*", "Volunteer"],
  ["/donor/*", "Donor"],
];

// Where the router ended up, query string included.
const Landed = ({ name }: { name: string }) => {
  const location = useLocation();
  return (
    <p data-testid="landed">
      {name} {location.pathname}
      {location.search}
    </p>
  );
};

const app = (
  <Routes>
    <Route path="/login" element={<Landed name="public login" />} />
    <Route path="/staff-portal/login" element={<Landed name="worker login" />} />
    <Route path="/forbidden" element={<Landed name="forbidden" />} />
    {DASHBOARDS.map(([path, role]) => (
      <Route
        key={path}
        path={path}
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={[role]}>
              <Landed name="dashboard" />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    ))}
  </Routes>
);

const landed = () => screen.getByTestId("landed").textContent;

describe("ProtectedRoute (signed out)", () => {
  test.each([
    ["/adopter/visits?visitID=12", "public login /login?redirect=%2Fadopter%2Fvisits%3FvisitID%3D12"],
    ["/volunteer/tasks", "public login /login?redirect=%2Fvolunteer%2Ftasks"],
    ["/donor/history", "public login /login?redirect=%2Fdonor%2Fhistory"],
    ["/staff/pets?status=available", "worker login /staff-portal/login?redirect=%2Fstaff%2Fpets%3Fstatus%3Davailable"],
    ["/admin/shelters", "worker login /staff-portal/login?redirect=%2Fadmin%2Fshelters"],
    ["/vet/appointments", "worker login /staff-portal/login?redirect=%2Fvet%2Fappointments"],
  ])("%s → %s", (page, expected) => {
    renderWithProviders(app, { route: page });

    expect(landed()).toBe(expected);
  });
});

describe("RoleRoute (signed in)", () => {
  test.each([
    ["Adopter", "/adopter/visits"],
    ["Staff", "/staff/pets"],
    ["Veterinarian", "/vet/appointments"],
    ["Admin", "/admin"],
  ])("%s on their own dashboard sees it", (role, page) => {
    renderWithProviders(app, { route: page, user: { role } });

    expect(landed()).toBe(`dashboard ${page}`);
  });

  test.each([
    ["Adopter", "/staff/pets"],
    ["Staff", "/admin/shelters"],
    ["Donor", "/adopter/applications"],
    ["Veterinarian", "/staff"],
  ])("%s on another role's dashboard (%s) → /forbidden", (role, page) => {
    renderWithProviders(app, { route: page, user: { role } });

    expect(landed()).toBe("forbidden /forbidden");
  });

  test("a token with no role (a half-restored session) → /forbidden", () => {
    useAuthStore.setState({ token: "test-token", role: null });

    renderWithProviders(app, { route: "/adopter" });

    expect(landed()).toBe("forbidden /forbidden");
  });
});
