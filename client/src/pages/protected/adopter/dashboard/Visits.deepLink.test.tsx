// The adopter Visits page's ?visitID= link — what a visit notification opens:
// that visit's details, the parameter then cleared, and the same when the
// adopter is already on the page. The visits request and the two slide-over
// panels are faked; the panel stand-in shows which visit it was opened for.
import { describe, expect, test, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { useLocation, useNavigate } from "react-router-dom";
import Visits from "./Visits";
import { renderWithProviders } from "../../../../test/render";

vi.mock("../../../../logic/api/adoptersApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/adoptersApi")>()),
  getMyVisits: vi.fn().mockResolvedValue([]),
}));
vi.mock("./sections/visits/VisitDetailPanel", () => ({
  default: ({ visitID }: { visitID: number | null }) =>
    visitID === null ? null : <div role="dialog">Visit {visitID} details</div>,
}));
vi.mock("./sections/visits/ScheduleVisitPanel", () => ({ default: () => null }));

// Shows the current URL, and lets a test navigate like a notification click.
let navigateTo: (to: string) => void;
const Location = () => {
  const location = useLocation();
  navigateTo = useNavigate();
  return <p data-testid="url">{location.pathname + location.search}</p>;
};

const renderAt = (route: string) =>
  renderWithProviders(
    <>
      <Visits />
      <Location />
    </>,
    { route, user: { role: "Adopter" } },
  );

describe("Visits ?visitID=", () => {
  test("opens that visit's details and clears the parameter", async () => {
    renderAt("/adopter/visits?visitID=12");

    expect(await screen.findByRole("dialog")).toHaveTextContent("Visit 12 details");
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/adopter\/visits$/);
  });

  test("without the parameter nothing opens", async () => {
    renderAt("/adopter/visits");

    await screen.findByTestId("url");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test.each(["abc", "0", "-4", "1.5"])("an invalid ID (%s) opens nothing but is still cleared", async (id) => {
    renderAt(`/adopter/visits?visitID=${id}`);

    expect(await screen.findByTestId("url")).toHaveTextContent(/^\/adopter\/visits$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("other parameters are kept", async () => {
    renderAt("/adopter/visits?visitID=12&tab=past");

    await screen.findByRole("dialog");
    expect(screen.getByTestId("url")).toHaveTextContent("/adopter/visits?tab=past");
  });

  test("clicking a notification while already on Visits opens the new visit", async () => {
    renderAt("/adopter/visits");
    await screen.findByTestId("url");

    act(() => navigateTo("/adopter/visits?visitID=34"));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Visit 34 details");
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/adopter\/visits$/);
  });
});
