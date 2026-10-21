// The shared render helper for component tests: the component inside the
// providers the app gives it (TanStack Query, the router), optionally signed
// in. Each render gets its own QueryClient, so no cache leaks between tests,
// with retries off so a failed request fails the test straight away.
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import useAuthStore from "../logic/store/useAuthStore";
import type { AuthUser } from "../logic/api/authApi";

interface RenderOptions {
  // The URL the router starts at, e.g. "/adopter/visits?visitID=12".
  route?: string;
  // Sign in before rendering (sets the auth store; no network call).
  user?: Partial<AuthUser> & { role: string };
}

export const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

export const renderWithProviders = (ui: ReactElement, { route = "/", user }: RenderOptions = {}) => {
  if (user) {
    useAuthStore.setState({
      user: { userID: 1, emailVerified: true, ...user },
      token: "test-token",
      role: user.role,
    });
  }
  const queryClient = testQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
};
