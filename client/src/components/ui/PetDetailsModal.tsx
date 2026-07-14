import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaPaw, FaTimes } from "react-icons/fa";
import { getPetById } from "../../logic/api/petsApi";
import useAuthStore from "../../logic/store/useAuthStore";
import ButtonElement from "./ButtonElement";

interface PetDetailsModalProps {
  petID: number | null;
  onClose: () => void;
}

const infoRowStyle = "flex items-center justify-between text-sm";
const boxStyle =
  "rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-4";
const boxHeadingStyle =
  "mb-2 text-sm font-bold uppercase tracking-wide text-neutral-charcoal";

const PetDetailsModal = ({ petID, onClose }: PetDetailsModalProps) => {
  const navigate = useNavigate();
  const { token, role } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pet", petID],
    queryFn: () => getPetById(petID!),
    enabled: petID !== null,
  });

  // Drives the mobile slide-up entrance. The modal doesn't unmount between
  // opens (petID just flips back to null and this component keeps
  // rendering null), so `entered` has to be reset to false and re-flipped
  // to true on every new open — otherwise the transition would only ever
  // play once, on the very first pet clicked. The rAF delay ensures the
  // browser paints the "off-screen" state first, so the flip to true is an
  // actual observed transition rather than a batched no-op.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (petID === null) return;
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [petID]);

  if (petID === null) return null;

  const hasCompatibilityInfo =
    data &&
    (data.compatibleWithChildren ||
      data.compatibleWithPets ||
      data.specialNeeds);

  // Adoption applications aren't built yet (next sprint) — logged-in
  // Adopters get a placeholder toast instead of a dead route. Every other
  // role is intentionally blocked here too: accounts are single-role by
  // design (a Volunteer/Staff/etc. account can't also adopt), so this is a
  // real distinction, not a stand-in for the not-logged-in case. Logged-out
  // users are sent to sign in first, same as ProtectedRoute does for
  // dashboards.
  const handleAdoptClick = () => {
    if (!token) {
      navigate("/login");
    } else if (role !== "Adopter") {
      toast("You need an adopter account to adopt pets");
    } else {
      toast("Coming Soon");
    }
  };

  return (
    // Backdrop: bottom sheet on mobile (items-end), centered card from sm
    // up — closing on backdrop click, same as the explicit close button.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white transition-transform duration-300 ease-out sm:max-w-lg sm:translate-y-0 sm:rounded-2xl sm:transition-none ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">
            Loading pet details...
          </p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Failed to load pet details.
          </p>
        )}

        {data && (
          <>
            {/* Sticky close button — a 0-height sticky wrapper so it pins to
                the top of the scrollable sheet (not just the photo) without
                adding to the layout flow, staying visible on scroll. */}
            <div className="sticky top-3 z-20 flex h-0 justify-end pr-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-dark hover:bg-white"
              >
                <FaTimes />
              </button>
            </div>

            {/* Photo */}
            <div className="aspect-square w-full">
              {data.petPhoto ? (
                <img
                  src={data.petPhoto}
                  alt={`${data.petName} photo`}
                  className="h-full w-full rounded-t-2xl object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-t-2xl bg-neutral-offwhite">
                  <FaPaw
                    className="h-16 w-16 text-rose-md"
                    aria-label={`${data.petName} photo placeholder`}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 p-6">
              {/* Name + breed/species */}
              <div>
                <h2 className="text-xl font-bold text-neutral-charcoal">
                  {data.petName}
                </h2>
                <p className="text-sm text-teal-dark">
                  {data.breed.breedName} | {data.breed.speciesName}
                </p>
              </div>

              {/* Basic info */}
              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>Basic Info</h3>
                <div className="flex flex-col gap-1.5">
                  <div className={infoRowStyle}>
                    <span className="text-neutral-gray">Gender</span>
                    <span className="font-semibold text-neutral-charcoal">
                      {data.petSex}
                    </span>
                  </div>
                  <div className={infoRowStyle}>
                    <span className="text-neutral-gray">Color</span>
                    <span className="font-semibold text-neutral-charcoal">
                      {data.petColor}
                    </span>
                  </div>
                  <div className={infoRowStyle}>
                    <span className="text-neutral-gray">
                      Height &amp; Weight
                    </span>
                    <span className="font-semibold text-neutral-charcoal">
                      {data.petHeight} cm | {data.petWeight} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* About */}
              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>About</h3>
                <p className="font-body font-light text-sm italic text-neutral-charcoal">
                  {data.petDesc || "No description available."}
                </p>
              </div>

              {/* Compatibility */}
              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>Compatibility</h3>
                <div className="flex flex-wrap gap-2">
                  {data.compatibleWithChildren && (
                    <span className="rounded-full border border-teal-md bg-teal-light px-3 py-1 text-xs text-teal-dark">
                      Good with children
                    </span>
                  )}
                  {data.compatibleWithPets && (
                    <span className="rounded-full border border-teal-md bg-teal-light px-3 py-1 text-xs text-teal-dark">
                      Good with other pets
                    </span>
                  )}
                  {data.specialNeeds && (
                    <span className="rounded-full border border-gold-md bg-gold-light px-3 py-1 text-xs text-neutral-charcoal">
                      Special needs
                    </span>
                  )}
                  {!hasCompatibilityInfo && (
                    <span className="text-xs italic text-neutral-gray">
                      No additional compatibility info.
                    </span>
                  )}
                </div>
              </div>

              {/* Shelter */}
              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>Shelter</h3>
                <p className="text-sm font-semibold text-neutral-charcoal">
                  {data.shelter.shelterName}
                </p>
                <p className="text-xs text-neutral-gray">
                  {data.shelter.shelterAddress}
                </p>
              </div>

              <ButtonElement
                onClick={handleAdoptClick}
                className="w-full bg-teal-dark text-center"
              >
                Adopt {data.petName}
              </ButtonElement>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PetDetailsModal;
