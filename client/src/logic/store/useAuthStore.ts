// What it does: Zustand global store holding the authenticated user's session, token, and role
import { create } from "zustand";
import { AuthUser } from "../../logic/api/authApi";
import { clearOnboardingSkipped } from "../onboardingSkip";

interface AuthState {
  // Defines the shape of your Zustand store
  user: AuthUser | null;
  token: string | null;
  role: string | null;
  login: (user: AuthUser, token: string, role: string) => void;
  logout: () => void;
  // Patches fields on the current user in place — e.g. onboardingStep after
  // advancing a wizard step, without a full re-login/refresh round trip.
  updateUser: (patch: Partial<AuthUser>) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  // Creates the Zustand store typed to AuthState
  user: null,
  token: null,
  role: null,

  login: (user, token, role) => set({ user, token, role }), // on login, updates all three state fields at once

  logout: () => {
    clearOnboardingSkipped(); // don't let a skip leak into whoever logs in next on this tab
    set({ user: null, token: null, role: null }); // on logout, resets everything to null - clears the session from memory
  },

  updateUser: (patch) =>
    set((state) => (state.user ? { user: { ...state.user, ...patch } } : {})),
}));

export default useAuthStore;
