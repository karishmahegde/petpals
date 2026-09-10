// AdoptApply.tsx
// Page: Entry point into the adoption application flow for a single pet.
// Responsibilities:
//   - Guards, run in order, on every mount (re-checked, not just at
//     click-time, since state can change during a login detour):
//       1. Not logged in            -> /login?redirect=/adopt/apply/:petID
//       2. Logged in, not an Adopter -> /adopt + toast
//       3. Pet not available         -> /adopt + toast
//       4. Active application exists -> /adopter/applications + toast
//   - Once all guards pass, renders the application form (pet summary +
//     Adopter Type / message-to-shelter, per the Part 4 spec).
// Route: /adopt/apply/:petID
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPaw } from "react-icons/fa";
import Badge from "../../../../components/ui/Badge";
import Card from "../../../../components/ui/Card";
import SegmentedControl from "../../../../components/ui/SegmentedControl";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import { getPetById } from "../../../../logic/api/petsApi";
import { getMyApplications } from "../../../../logic/api/adoptersApi";
import {
  createCheckoutSession,
  type CreateApplicationPayload,
} from "../../../../logic/api/adoptionApplicationsApi";
import { showAdopterAccountToast } from "../../../../logic/toast/adopterAccountToast";
import { saveApplyDraft, loadApplyDraft } from "../../../../logic/adoptApplyDraft";
import useAuthStore from "../../../../logic/store/useAuthStore";

const ACTIVE_STATUSES = ["Pending", "Accepted"];

const APPLICATION_TYPE_OPTIONS = [
  { value: "Adopt", label: "Adopt" },
  { value: "Foster", label: "Foster" },
];

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const AdoptApply = () => {
  const { petID: petIDParam } = useParams();
  const petID = Number(petIDParam);
  const navigate = useNavigate();
  const { token, role } = useAuthStore();

  const isAdopter = !!token && role === "Adopter";

  // Guard 1 + 2 - auth and role, re-checked on every mount.
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

  // Guard 3 - pet availability, re-fetched (not cached/route-state).
  // `["pet", petID]` is the same key PetDetailsModal uses, so on arrival
  // here from the modal this query already has cached data and resolves
  // instantly - but that data may be stale. isLoading (isPending &&
  // isFetching) goes false the moment ANY cached data exists, even mid
  // background-revalidation, so it can't be used to gate rendering here.
  // isFetching stays true through that revalidation, so petSettled below
  // only becomes true once this mount's own fetch has actually resolved -
  // otherwise the form could render for a beat on stale "available" data
  // before flipping to unavailable and redirecting away.
  const {
    data: pet,
    isFetching: petFetching,
    isError: petError,
  } = useQuery({
    queryKey: ["pet", petID],
    queryFn: () => getPetById(petID),
    enabled: isAdopter && Number.isInteger(petID),
  });

  const petAvailable = !!pet && pet.adoptionStatus === "available";
  const petSettled = !petFetching && (pet !== undefined || petError);

  useEffect(() => {
    if (!isAdopter || !petSettled) return;
    if (petError || !petAvailable) {
      navigate("/adopt", { replace: true });
      toast("This pet is no longer available for adoption.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdopter, petSettled, petError, petAvailable]);

  // Guard 4 - duplicate active application. Only runs once guard 3 has
  // genuinely settled (pet availability is the more fundamental failure and
  // must short-circuit first) - same stale-cache reasoning as above applies
  // here too, since this page can be revisited for the same pet.
  const { data: existingApplications, isFetching: applicationsFetching } =
    useQuery({
      queryKey: ["myApplications", petID],
      queryFn: () => getMyApplications({ petID }),
      enabled: isAdopter && petSettled && petAvailable,
    });

  const hasActiveApplication = !!existingApplications?.some((app) =>
    ACTIVE_STATUSES.includes(app.applicationStatus),
  );
  const applicationsSettled =
    !applicationsFetching && existingApplications !== undefined;

  useEffect(() => {
    if (!applicationsSettled || !hasActiveApplication) return;
    navigate("/adopter/applications", { replace: true });
    toast(
      "You already have an active application for this pet - please check your dashboard for status.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationsSettled, hasActiveApplication]);

  const allGuardsPassed =
    isAdopter &&
    petSettled &&
    petAvailable &&
    applicationsSettled &&
    !hasActiveApplication;

  // Form state - declared unconditionally (before the guard early-return
  // below) since hooks can't be conditional, even though this state is only
  // ever shown once allGuardsPassed is true. Stripe Checkout is a full-page
  // redirect, so if the adopter backs out and lands back here (cancel_url),
  // React state is gone - restore from the sessionStorage draft saved right
  // before that redirect, if one exists for this pet.
  const [applicationType, setApplicationType] = useState<
    "Adopt" | "Foster" | null
  >(() => loadApplyDraft(petID)?.applicationType ?? null);
  const [shelterMessage, setShelterMessage] = useState(
    () => loadApplyDraft(petID)?.shelterMessage ?? "",
  );
  const [showCancelModal, setShowCancelModal] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: CreateApplicationPayload) =>
      createCheckoutSession(payload),
    onSuccess: ({ checkoutUrl }) => {
      // Leaving the SPA entirely for Stripe's hosted page - not a
      // navigate(). The application row doesn't exist yet; it's only
      // created once the webhook confirms payment (see AdoptApplyConfirmation).
      window.location.href = checkoutUrl;
    },
    onError: (err) => {
      toast(extractError(err));
    },
  });

  const handleSubmit = () => {
    if (!pet || applicationType === null) return;
    saveApplyDraft(petID, { applicationType, shelterMessage });
    mutation.mutate({
      petID: pet.petID,
      shelterID: pet.shelter.shelterID,
      applicationType,
      shelterMessage: shelterMessage.trim() || null,
    });
  };

  const handleCancelClick = () => {
    if (!shelterMessage.trim() && applicationType === null) {
      navigate(-1);
      return;
    }
    setShowCancelModal(true);
  };

  if (!allGuardsPassed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="font-body text-sm text-neutral-gray">
          {!petSettled ? "Loading pet details..." : "Checking eligibility..."}
        </p>
      </div>
    );
  }

  const hasCompatibilityInfo =
    pet.compatibleWithChildren || pet.compatibleWithPets || pet.specialNeeds;

  return (
    <div className="min-h-screen bg-neutral-offwhite px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-3xl text-neutral-dark">
          Adoption Application
        </h1>

        {/* Pet summary card - data already loaded by the guard above, no
            separate fetch. */}
        <Card className="mb-6 p-5">
          <div className="flex items-center gap-4">
            {pet.petPhoto ? (
              <img
                src={pet.petPhoto}
                alt={`${pet.petName} photo`}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-neutral-offwhite">
                <FaPaw
                  className="h-8 w-8 text-rose-md"
                  aria-label={`${pet.petName} photo placeholder`}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <h2 className="font-body text-lg font-bold text-neutral-charcoal">
                {pet.petName}
              </h2>
              <p className="font-body text-sm text-neutral-gray">
                {pet.breed.breedName} ({pet.breed.speciesName}) · {pet.petSex}
              </p>
              <div className="flex flex-wrap gap-2">
                {pet.compatibleWithChildren && (
                  <Badge tone="teal" variant="outline">
                    Good with children
                  </Badge>
                )}
                {pet.compatibleWithPets && (
                  <Badge tone="teal" variant="outline">
                    Good with other pets
                  </Badge>
                )}
                {pet.specialNeeds && (
                  <Badge tone="gold" variant="outline">
                    Special needs
                  </Badge>
                )}
                {!hasCompatibilityInfo && (
                  <span className="font-body text-xs italic text-neutral-gray">
                    No additional compatibility info.
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-neutral-gray">
                {pet.shelter.shelterName} · {pet.shelter.shelterAddress}
              </p>
            </div>
          </div>
        </Card>

        {/* Application card */}
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-2">
            <label className="font-body text-sm font-bold text-neutral-dark">
              Adopter Type
            </label>
            <SegmentedControl
              options={APPLICATION_TYPE_OPTIONS}
              value={applicationType}
              onChange={(value) =>
                setApplicationType(value as "Adopt" | "Foster")
              }
            />
          </div>

          <div className="mb-6 flex flex-col gap-1.5">
            <label className="font-body text-sm font-bold text-neutral-dark">
              Message to shelter{" "}
              <span className="font-normal text-neutral-gray">(optional)</span>
            </label>
            <textarea
              value={shelterMessage}
              onChange={(e) => setShelterMessage(e.target.value)}
              placeholder="Tell us a bit about why you'd be a great match"
              rows={5}
              maxLength={500}
              className="w-full rounded-lg border border-rose-light bg-white px-3 py-2 font-body text-sm text-neutral-dark focus:border-teal-dark focus:outline-none"
            />
          </div>

          {/* Fee disclosure - clearly visible, not fine print, per spec §3.1. */}
          <div className="mb-6 rounded-lg border border-gold-md bg-gold-light p-4">
            <p className="font-body text-sm font-bold text-neutral-charcoal">
              $15.00 USD application processing fee
            </p>
            <p className="mt-1 font-body text-xs text-neutral-charcoal">
              This fee is non-refundable, including if your application is
              declined or withdrawn.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={applicationType === null || mutation.isPending}
            className="w-full rounded-xl bg-teal-dark py-3 font-body text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending
              ? "Redirecting to payment…"
              : "Continue to Payment"}
          </button>
          <button
            type="button"
            onClick={handleCancelClick}
            className="mt-3 w-full text-center font-body text-sm text-neutral-gray hover:text-neutral-dark"
          >
            Cancel
          </button>
        </Card>
      </div>

      <ConfirmActionModal
        isOpen={showCancelModal}
        title="Cancel application?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setShowCancelModal(false)}
        onConfirm={() => navigate(-1)}
      >
        Are you sure you want to cancel? Your application hasn't been submitted.
      </ConfirmActionModal>
    </div>
  );
};

export default AdoptApply;
