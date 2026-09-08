// "Skip for now" on the onboarding wizard doesn't complete onboarding — it
// just lets the adopter browse the rest of the app for this browser
// session (see OnboardingGate.tsx). sessionStorage (not Zustand) so it
// survives a page refresh but resets on the next real login — cleared
// explicitly there, never via the silent session-restore bootstrap in
// App.tsx — or when the tab closes.
const STORAGE_KEY = "petpals:onboardingSkipped";

export const isOnboardingSkipped = (): boolean => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const setOnboardingSkipped = (): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // sessionStorage unavailable (private mode, etc.) — skip just won't
    // persist across a refresh; not worth surfacing an error for.
  }
};

export const clearOnboardingSkipped = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // see setOnboardingSkipped
  }
};
