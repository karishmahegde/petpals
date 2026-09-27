// Ends the session from the UI (Log out, closing your own account): leaves
// for `destination` and clears the session in ONE render.
//
// Doing the two one after the other isn't enough: the Zustand store update
// can re-render before React Router applies the navigation, so the current
// protected page briefly renders logged out and ProtectedRoute redirects to
// /login?redirect=<this page>. flushSync makes both updates land in the same
// render, so the old page never sees an empty session.
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";

const useEndSession = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  return (destination: string) => {
    flushSync(() => {
      navigate(destination, { replace: true });
      logout();
    });
  };
};

export default useEndSession;
