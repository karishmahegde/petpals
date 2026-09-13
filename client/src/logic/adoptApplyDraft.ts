// Stripe Checkout is a full-page redirect, so React state doesn't survive
// the round trip. If the adopter cancels out of Stripe and lands back on
// /adopt/apply/:petID, this is what restores applicationType/shelterMessage
// instead of showing a blank form. Same sessionStorage pattern as
// onboardingSkip.ts, keyed per pet so it can't bleed across pets.
export interface AdoptApplyDraft {
  applicationType: "Adopt" | "Foster" | null;
  shelterMessage: string;
}

const storageKey = (petID: number) => `petpals:adoptApplyDraft:${petID}`;

export const saveApplyDraft = (petID: number, draft: AdoptApplyDraft): void => {
  try {
    sessionStorage.setItem(storageKey(petID), JSON.stringify(draft));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the draft just
    // won't survive the redirect; not worth surfacing an error for.
  }
};

export const loadApplyDraft = (petID: number): AdoptApplyDraft | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(petID));
    return raw ? (JSON.parse(raw) as AdoptApplyDraft) : null;
  } catch {
    return null;
  }
};

export const clearApplyDraft = (petID: number): void => {
  try {
    sessionStorage.removeItem(storageKey(petID));
  } catch {
    // see saveApplyDraft
  }
};
