// What it does: Zustand store for the adopter's AI matches popup — whether
// it's open, and whether it's showing the quiz for a retake. Global so more
// than one place can open it: the floating AI button (MatchesLauncher) and
// the Profile page's quiz card. MatchesLauncher resets it when it unmounts
// (leaving the adopter dashboard, e.g. on logout), so nothing carries over to
// the next user on this tab.
import { create } from "zustand";

interface MatchesPopupState {
  isOpen: boolean;
  // Set on first open and never cleared until reset — the popup mounts on
  // first open (so the matches query only runs once it's wanted) and is then
  // only hidden, keeping a half-done quiz across close/reopen.
  hasOpened: boolean;
  // true while retaking the quiz — otherwise the popup shows the quiz only
  // until it's taken, and the matches after.
  isRetaking: boolean;
  // `retake` opens straight onto the quiz even when it's already taken.
  open: (options?: { retake?: boolean }) => void;
  close: () => void;
  setRetaking: (isRetaking: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = { isOpen: false, hasOpened: false, isRetaking: false };

const useMatchesPopupStore = create<MatchesPopupState>((set) => ({
  ...INITIAL_STATE,
  open: ({ retake = false } = {}) =>
    set((state) => ({
      isOpen: true,
      hasOpened: true,
      isRetaking: retake || state.isRetaking,
    })),
  close: () => set({ isOpen: false }),
  setRetaking: (isRetaking) => set({ isRetaking }),
  reset: () => set(INITIAL_STATE),
}));

export default useMatchesPopupStore;
