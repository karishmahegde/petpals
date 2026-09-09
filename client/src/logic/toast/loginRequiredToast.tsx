// Shared "log in to save favorites" toast — shown whenever a logged-out
// visitor clicks a favorite heart. Mirrors adopterAccountToast.tsx's shape
// so the two related toasts behave identically.
import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";

export const showLoginRequiredToast = (navigate: NavigateFunction) => {
  toast((t) => (
    <span>
      Log in to save favorites.{" "}
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          navigate("/login");
        }}
        className="font-semibold underline"
      >
        Log in here
      </button>
    </span>
  ));
};
