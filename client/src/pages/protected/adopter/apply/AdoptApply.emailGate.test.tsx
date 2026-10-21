// The email-verification soft gate on the apply page: an adopter whose email
// isn't verified sees the "Verify your email first" notice instead of
// Continue to Payment; a 409 email_unverified from the server flips the page
// to the notice; and the notice's Resend button works. The pet, application
// and verification calls are faked.
import { beforeEach, describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { Route, Routes } from "react-router-dom";
import AdoptApply from "./AdoptApply";
import { renderWithProviders } from "../../../../test/render";
import useAuthStore from "../../../../logic/store/useAuthStore";
import { getPetById } from "../../../../logic/api/petsApi";
import { getMyApplications } from "../../../../logic/api/adoptersApi";
import { createCheckoutSession } from "../../../../logic/api/adoptionApplicationsApi";
import { requestEmailVerification } from "../../../../logic/api/authApi";

vi.mock("../../../../logic/api/petsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/petsApi")>()),
  getPetById: vi.fn(),
}));
vi.mock("../../../../logic/api/adoptersApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/adoptersApi")>()),
  getMyApplications: vi.fn(),
}));
vi.mock("../../../../logic/api/adoptionApplicationsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/adoptionApplicationsApi")>()),
  createCheckoutSession: vi.fn(),
}));
vi.mock("../../../../logic/api/authApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../logic/api/authApi")>()),
  requestEmailVerification: vi.fn(),
}));

// An axios error with the API's error envelope.
const apiError = (status: number, reason: string) =>
  new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, message: "...", error: { code: "CONFLICT", details: { reason } } },
  });

const renderApply = (emailVerified: boolean | undefined) =>
  renderWithProviders(
    <Routes>
      <Route path="/adopt/apply/:petID" element={<AdoptApply />} />
    </Routes>,
    { route: "/adopt/apply/5", user: { role: "Adopter", emailVerified } },
  );

const payButton = () => screen.queryByRole("button", { name: "Continue to Payment" });
const notice = () => screen.queryByText("Verify your email first");

beforeEach(() => {
  vi.mocked(getPetById).mockReset().mockResolvedValue({
    petID: 5,
    petName: "Biscuit",
    petPhoto: null,
    petSex: "Female",
    adoptionStatus: "available",
    compatibleWithChildren: true,
    compatibleWithPets: true,
    specialNeeds: false,
    breed: { breedID: 3, breedName: "Beagle", speciesName: "Dog" },
    shelter: { shelterID: 3, shelterName: "PetPals Downtown", shelterAddress: "1 Main St" },
  } as never);
  vi.mocked(getMyApplications).mockReset().mockResolvedValue([] as never);
  vi.mocked(createCheckoutSession).mockReset();
  vi.mocked(requestEmailVerification).mockReset();
  window.sessionStorage.clear();
});

describe("AdoptApply email gate", () => {
  test("a verified adopter gets Continue to Payment, no notice", async () => {
    renderApply(true);

    expect(await screen.findByRole("button", { name: "Continue to Payment" })).toBeInTheDocument();
    expect(notice()).not.toBeInTheDocument();
  });

  test("an unverified adopter gets the notice instead of the payment button", async () => {
    renderApply(false);

    expect(await screen.findByText("Verify your email first")).toBeInTheDocument();
    expect(screen.getByText(/You'll need a verified email address to apply to adopt/)).toBeInTheDocument();
    expect(payButton()).not.toBeInTheDocument();
  });

  test("a session from before verification existed (no flag) isn't gated — the server decides", async () => {
    renderApply(undefined);

    expect(await screen.findByRole("button", { name: "Continue to Payment" })).toBeInTheDocument();
  });

  test("the server's 409 email_unverified on submit swaps the button for the notice", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(apiError(409, "email_unverified"));
    renderApply(true);
    await userEvent.click(await screen.findByRole("button", { name: /^Adopt/ }));

    await userEvent.click(screen.getByRole("button", { name: "Continue to Payment" }));

    expect(await screen.findByText("Verify your email first")).toBeInTheDocument();
    expect(payButton()).not.toBeInTheDocument();
    expect(useAuthStore.getState().user?.emailVerified).toBe(false);
  });

  test("Resend in the notice asks for a new link", async () => {
    vi.mocked(requestEmailVerification).mockResolvedValue();
    renderApply(false);

    await userEvent.click(await screen.findByRole("button", { name: "Resend verification email" }));

    expect(requestEmailVerification).toHaveBeenCalledTimes(1);
  });

  test("Resend answering 'already verified' (verified elsewhere) brings the payment button back", async () => {
    vi.mocked(requestEmailVerification).mockRejectedValue(apiError(409, "already_verified"));
    renderApply(false);

    await userEvent.click(await screen.findByRole("button", { name: "Resend verification email" }));

    expect(await screen.findByRole("button", { name: "Continue to Payment" })).toBeInTheDocument();
    expect(notice()).not.toBeInTheDocument();
  });
});
