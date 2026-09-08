// AdoptApply.tsx
// Page: Entry point into the adoption application flow for a single pet.
// Responsibilities:
//   - Guards, run in order, on every mount (re-checked, not just at
//     click-time, since state can change during a login detour):
//       1. Not logged in            -> /login?redirect=/adopt/apply/:petID
//       2. Logged in, not an Adopter -> /adopt + toast
//       3. Pet not available         -> /adopt + toast
//       4. Active application exists -> /adopter/applications + toast
//   - Once all guards pass, renders a placeholder. The application form
//     itself (fields, validation, pre-fill) is a separate follow-up spec.
// Route: /adopt/apply/:petID
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getPetById } from "../../../logic/api/petsApi";
import { getMyApplications } from "../../../logic/api/adoptersApi";
import { showAdopterAccountToast } from "../../../logic/toast/adopterAccountToast";
import useAuthStore from "../../../logic/store/useAuthStore";

const ACTIVE_STATUSES = ["Pending", "Accepted"];

const AdoptApply = () => {
  const { petID: petIDParam } = useParams();
  const petID = Number(petIDParam);
  const navigate = useNavigate();
  const { token, role } = useAuthStore();

  const isAdopter = !!token && role === "Adopter";

  // Guard 1 + 2 — auth and role, re-checked on every mount.
  useEffect(() => {
    if (!token) {
      navigate(`/login?redirect=/adopt/apply/${petID}`, { replace: true });
      return;
    }
    if (role !== "Adopter") {
      navigate("/adopt", { replace: true });
      showAdopterAccountToast(navigate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  // Guard 3 — pet availability, re-fetched (not cached/route-state).
  const {
    data: pet,
    isLoading: petLoading,
    isError: petError,
  } = useQuery({
    queryKey: ["pet", petID],
    queryFn: () => getPetById(petID),
    enabled: isAdopter && Number.isInteger(petID),
  });

  const petAvailable = !!pet && pet.adoptionStatus === "available";

  useEffect(() => {
    if (!isAdopter || (!pet && !petError)) return;
    if (petError || !petAvailable) {
      navigate("/adopt", { replace: true });
      toast("This pet is no longer available for adoption.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdopter, pet, petError, petAvailable]);

  // Guard 4 — duplicate active application. Only runs once guard 3 has
  // passed (pet availability is the more fundamental failure and must
  // short-circuit first).
  const { data: existingApplications } = useQuery({
    queryKey: ["myApplications", petID],
    queryFn: () => getMyApplications({ petID }),
    enabled: isAdopter && petAvailable,
  });

  const hasActiveApplication = !!existingApplications?.some((app) =>
    ACTIVE_STATUSES.includes(app.applicationStatus),
  );

  useEffect(() => {
    if (!existingApplications || !hasActiveApplication) return;
    navigate("/adopter/applications", { replace: true });
    toast(
      "You already have an active application for this pet — check your dashboard for status.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingApplications, hasActiveApplication]);

  const allGuardsPassed =
    isAdopter &&
    petAvailable &&
    !!existingApplications &&
    !hasActiveApplication;

  if (!allGuardsPassed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="font-body text-sm text-neutral-gray">
          {petLoading ? "Loading pet details..." : "Checking eligibility..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-display text-2xl text-neutral-dark mb-2">
        Apply to adopt {pet.petName}
      </h1>
      <p className="font-body text-sm text-neutral-gray">
        The application form is coming soon.
      </p>
    </div>
  );
};

export default AdoptApply;
