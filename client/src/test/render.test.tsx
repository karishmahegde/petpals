// Proves the test setup itself: jsdom, the jest-dom matchers, the router,
// TanStack Query and the signed-in auth store all work through the helper.
import { describe, expect, test } from "vitest";
import { screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import useAuthStore from "../logic/store/useAuthStore";
import { renderWithProviders } from "./render";

const Probe = () => {
  const location = useLocation();
  const role = useAuthStore((state) => state.role);
  const { data } = useQuery({ queryKey: ["probe"], queryFn: async () => "loaded" });
  return (
    <p>
      {location.pathname}
      {location.search} · {role ?? "signed out"} · {data ?? "loading"}
    </p>
  );
};

describe("renderWithProviders", () => {
  test("starts the router at the given route, signed in, with a working query client", async () => {
    renderWithProviders(<Probe />, { route: "/adopter/visits?visitID=12", user: { role: "Adopter" } });

    expect(await screen.findByText("/adopter/visits?visitID=12 · Adopter · loaded")).toBeInTheDocument();
  });

  test("a previous test's sign-in doesn't carry over", () => {
    renderWithProviders(<Probe />);

    expect(screen.getByText(/signed out/)).toBeInTheDocument();
  });
});
