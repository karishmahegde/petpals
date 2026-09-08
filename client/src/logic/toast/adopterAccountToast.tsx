// Shared "you need an adopter account" toast — shown at every point a
// non-Adopter is blocked from the adoption application flow (Login.tsx,
// PetDetailsModal.tsx, AdoptApply.tsx). Kept as one helper so the copy and
// the sign-up link behave identically everywhere, per the entry-routing
// spec's requirement that this experience not vary by session state.
import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";

export const showAdopterAccountToast = (navigate: NavigateFunction) => {
  toast((t) => (
    <span>
      You need an adopter account to apply for adoption.{" "}
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          navigate("/register");
        }}
        className="font-semibold underline"
      >
        Create one here
      </button>
    </span>
  ));
};
