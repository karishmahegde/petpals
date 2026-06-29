// What it does: Zustand global store holding the authenticated user's session, token, and role
import { create } from "zustand";
import { AuthUser } from "../api/authApi";

interface AuthState {
  // Defines the shape of your Zustand store
  user: AuthUser | null;
  token: string | null;
  role: string | null;
  login: (user: AuthUser, token: string, role: string) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  // Creates the Zustand store typed to AuthState
  user: null,
  token: null,
  role: null,

  login: (user, token, role) => set({ user, token, role }), // on login, updates all three state fields at once

  logout: () => set({ user: null, token: null, role: null }), // on logout, resets everything to null - clears the session from memory
}));

export default useAuthStore;
