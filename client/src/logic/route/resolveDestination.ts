// Shared by every login entry point (public Login.tsx and worker-portal
// WorkerLogin.tsx): right after a fresh login, and an already-authenticated
// user hitting the login page directly. `redirectParam` comes from every
// guarded route (ProtectedRoute sets it generically), so this doesn't
// pre-filter by role — the redirect target enforces its own access.
export const resolveDestination = (
  userRole: string,
  redirectParam: string | null,
) => redirectParam || `/${userRole.toLowerCase()}`;
