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

// Admin, Staff and Veterinarian sign in through the worker portal
// (WorkerLogin.tsx), not the public /login — so that's where they're sent
// when their session ends.
const WORKER_ROLES = new Set(["Admin", "Staff", "Veterinarian"]);

const WORKER_LOGIN_PATH = "/staff-portal/login";

// Where a session that ended on its own (401 — expired, deactivated,
// declined) sends the user to sign in again.
export const loginPathFor = (role: string | null): string =>
  role && WORKER_ROLES.has(role) ? WORKER_LOGIN_PATH : "/login";

// Worker dashboards (/staff, /admin, /vet) — their login page is the worker
// portal's, so ProtectedRoute sends a signed-out visitor there instead.
const WORKER_DASHBOARD_ROOTS = new Set(
  [...WORKER_ROLES].map((role) => ROLE_DASHBOARD[role].slice(1)),
);

export const loginPathForPage = (path: string): string => {
  const first = path.split(/[/?#]/)[1];
  return WORKER_DASHBOARD_ROOTS.has(first) ? WORKER_LOGIN_PATH : "/login";
};

// Where the Log out button takes the user: workers back to their own login
// page; everyone else to the public home page.
export const logoutDestinationFor = (role: string | null): string =>
  role && WORKER_ROLES.has(role) ? WORKER_LOGIN_PATH : "/";

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
