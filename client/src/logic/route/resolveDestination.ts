// Shared by every login entry point (public Login.tsx and worker-portal
// WorkerLogin.tsx): right after a fresh login, and an already-authenticated
// user hitting the login page directly. `redirectParam` comes from every
// guarded route (ProtectedRoute sets it generically). It's followed as-is —
// the target enforces its own access — except a redirect into ANOTHER
// role's dashboard (e.g. /staff/... after logging in as Admin), which could
// only ever end at /forbidden: that falls back to the user's own dashboard.

// DB role → its dashboard root (App.tsx's routes). Not just
// role.toLowerCase() — Veterinarian lives at /vet.
const ROLE_DASHBOARD: Record<string, string> = {
  Admin: "/admin",
  Adopter: "/adopter",
  Staff: "/staff",
  Veterinarian: "/vet",
  Volunteer: "/volunteer",
  Donor: "/donor",
};

export const dashboardPathFor = (role: string): string =>
  ROLE_DASHBOARD[role] ?? "/";

const DASHBOARD_ROOTS = Object.values(ROLE_DASHBOARD).map((path) => path.slice(1));

const dashboardRootOf = (path: string): string | undefined => {
  const first = path.split(/[/?#]/)[1];
  return DASHBOARD_ROOTS.includes(first) ? first : undefined;
};

export const resolveDestination = (
  userRole: string,
  redirectParam: string | null,
) => {
  const ownDashboard = dashboardPathFor(userRole);
  if (!redirectParam) return ownDashboard;
  const root = dashboardRootOf(redirectParam);
  return root && `/${root}` !== ownDashboard ? ownDashboard : redirectParam;
};
