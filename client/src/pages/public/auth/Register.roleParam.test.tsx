// Register's ?role= preselect: the volunteer page's Sign up button links to
// /register?role=volunteer, so that option starts selected (and the shelter
// picker it needs is shown). Anything other than the three public roles is
// ignored. The API modules are mocked — nothing is sent.
import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import Register from "./Register";
import { renderWithProviders } from "../../../test/render";

vi.mock("../../../logic/api/authApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../logic/api/authApi")>()),
  register: vi.fn(),
}));
vi.mock("../../../logic/api/petsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../logic/api/petsApi")>()),
  getShelters: vi.fn().mockResolvedValue([]),
}));

const option = (name: RegExp) => screen.getByRole("button", { name });

describe("Register ?role=", () => {
  test("?role=volunteer → Volunteer starts selected", () => {
    renderWithProviders(<Register />, { route: "/register?role=volunteer" });

    expect(option(/Volunteer/)).toHaveAttribute("aria-pressed", "true");
    expect(option(/Adopter/)).toHaveAttribute("aria-pressed", "false");
    expect(option(/Donor/)).toHaveAttribute("aria-pressed", "false");
  });

  test.each(["/register", "/register?role=admin", "/register?role=Volunteer"])(
    "%s → nothing preselected",
    (route) => {
      renderWithProviders(<Register />, { route });

      for (const name of [/Adopter/, /Volunteer/, /Donor/]) {
        expect(option(name)).toHaveAttribute("aria-pressed", "false");
      }
    },
  );
});
