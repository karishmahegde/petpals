// The app-wide TanStack Query client. Its own module (rather than inline in
// main.tsx) so non-component code can reach it — e.g. useAuthStore.logout()
// calls queryClient.clear() so the next user on this tab never sees the
// previous session's cached data.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays "fresh" for a minute, so switching between dashboard
      // sections (each a route that unmounts) serves the cache without a
      // refetch. Mutations still invalidate their keys explicitly, so writes
      // show through immediately. The Stripe confirmation poll drives its own
      // refetchInterval and is unaffected.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
