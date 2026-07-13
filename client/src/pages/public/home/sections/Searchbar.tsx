import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SectionContainer from "../../../../components/ui/SectionContainer";
import SectionHeading from "../../../../components/ui/SectionHeading";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import { HiOutlineLocationMarker } from "react-icons/hi";
import { useQuery } from "@tanstack/react-query";
import { getSpecies } from "../../../../logic/api/petsApi";
import toast from "react-hot-toast";

const Searchbar = () => {
  // "Species" or "Location" — which search mode is currently active.
  // This is the single source of truth for priority at submit time: if
  // the user has entered data for both modes, whichever mode filter is
  // currently set to wins, regardless of what's sitting in the other.
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("Species");

  const [isSpeciesOpen, setIsSpeciesOpen] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [zipInput, setZipInput] = useState("");

  // Location filter state. coords is only populated by a successful
  // geolocation call — a failed attempt leaves it null, which is what
  // lets a subsequent zip search still work (see handleSubmit).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);

  // Refs for the two independent dropdowns, used to detect outside clicks
  // and close whichever one is open.
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const speciesMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
      if (
        speciesMenuRef.current &&
        !speciesMenuRef.current.contains(e.target as Node)
      ) {
        setIsSpeciesOpen(false);
      }
    };
    window.addEventListener("click", onClickAway);
    return () => window.removeEventListener("click", onClickAway);
  }, []);

  const navigate = useNavigate();

  // Fetches immediately on mount, independent of anything else on this
  // page — same species list PetFilterBar uses, and likely already cached
  // by TanStack Query if the user has visited /adopt in this session.
  const { data: species = [] } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
  });

  // Populates coords (or shows a toast on failure) only — the actual
  // search/navigation happens separately in handleSubmit, so a failed
  // geolocation attempt never blocks a subsequent zip-based search.
  const handleGeolocateClick = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't supported by this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast.success("Location obtained");
      },
      () => {
        setIsLocating(false);
        toast.error(
          "Couldn't get your location. Check permissions and try again.",
        );
      },
    );
  };

  // Builds the /adopt URL and navigates — this component never fetches
  // pets directly. PetCatalog.tsx (a separate page) is the sole owner of
  // filter state and the pets query; it's expected to read these query
  // params on mount and seed its own state from them.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (filter === "Species") {
      if (!selectedSpecies) {
        toast.error("Please select a species.");
        return;
      }
      // Species is stored here by name (for display), but /pets filters
      // by speciesID — look up the matching ID before navigating.
      const match = species.find((s) => s.speciesName === selectedSpecies);
      navigate(`/adopt?speciesID=${match?.speciesID}`);
      return;
    }

    // Location mode: a successfully-obtained current location always
    // takes priority over a typed zip, even if both are present —
    // matches the same rule used in ShelterLocationFilter.
    if (coords) {
      navigate(`/adopt?lat=${coords.lat}&lng=${coords.lng}`);
    } else if (/^\d{5}$/.test(zipInput)) {
      navigate(`/adopt?postalCode=${zipInput}`);
    } else {
      toast.error("Enter a ZIP code or use your current location.");
    }
  };

  return (
    <SectionContainer className="bg-teal">
      <SectionHeading>Find the purr-fect pet!</SectionHeading>
      <p className="font-light">
        Search by species or your nearest adoption center
      </p>
      <form onSubmit={handleSubmit} className="relative my-10 w-full lg:flex">
        {/* First dropdown: Species / Location mode toggle. Full-width,
            bordered, own rounded corners on mobile; merges into the left
            edge of the pill shape at lg (border removed, only the left
            side rounded, since it visually joins the next element). */}
        <div
          className="px-6 py-3 w-full my-3 bg-white rounded-lg border-2 border-neutral-lightgray lg:my-0 lg:w-40 lg:rounded-l-full lg:border-none relative"
          ref={filterMenuRef}
        >
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-full text-teal-dark"
          >
            {filter}
            <FaChevronDown
              className={`h-3 w-3 text-black transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <ul className="absolute left-0 top-full mt-1 w-full p-2 rounded-lg font-light bg-white shadow z-10">
              <li className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilter("Species");
                    setIsOpen(false);
                  }}
                >
                  Species
                </button>
              </li>
              <li className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilter("Location");
                    setIsOpen(false);
                  }}
                >
                  Location
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Second slot — its content swaps entirely based on filter,
            rather than showing/hiding two separate elements. */}
        {filter === "Species" ? (
          <div
            className="flex-1 mx-0 rounded-lg border-2 border-neutral-lightgray px-6 py-3 bg-white relative lg:border-none lg:rounded-none lg:mx-1"
            ref={speciesMenuRef}
          >
            <button
              type="button"
              onClick={() => setIsSpeciesOpen(!isSpeciesOpen)}
              className="flex items-center justify-between w-full"
            >
              <span className={selectedSpecies ? "" : "text-teal-dark"}>
                {selectedSpecies || "Select a species"}
              </span>
              <FaChevronDown
                className={`h-3 w-3 transition-transform ${isSpeciesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isSpeciesOpen && (
              <ul className="absolute left-0 top-full mt-1 w-full p-2 rounded-lg font-light bg-white shadow z-10">
                {species.map((s) => (
                  <li key={s.speciesID} className="p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecies(s.speciesName);
                        setIsSpeciesOpen(false);
                      }}
                    >
                      {s.speciesName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          // Zip input + geolocation button. Both stay visible/typeable
          // at all times, regardless of which one the user tries first —
          // priority between them is only resolved at submit (handleSubmit).
          <div className="flex-1 mx-0 rounded-lg border-2 border-neutral-lightgray px-6 py-3 bg-white flex flex-col sm:flex-row items-stretch lg:border-none lg:rounded-none lg:mx-1 gap-2">
            <input
              type="text"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder="Enter ZIP code or use your current location"
              className="flex-1 min-w-0 py-3 placeholder:italic placeholder:font-light placeholder:text-sm placeholder:text-teal-dark focus:outline-none lg:py-0"
            />

            <button
              type="button"
              onClick={handleGeolocateClick}
              className="flex items-center justify-center gap-1 whitespace-nowrap rounded-md bg-gold-md px-4 py-1 text-xs text-white"
            >
              <HiOutlineLocationMarker />
              <span>{isLocating ? "Locating…" : "use current location"}</span>
            </button>
          </div>
        )}

        {/* Desktop submit — icon-only, joins the right edge of the pill */}
        <button
          type="submit"
          aria-label="Search"
          title="Search"
          className="hidden lg:flex items-center justify-center rounded-r-full bg-teal-dark px-6 hover:bg-gold-md"
        >
          <FaSearch className="h-4 w-4 text-white" />
        </button>

        {/* Mobile submit — full-width, labeled, stacks below the fields */}
        <button
          type="submit"
          className="lg:hidden mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-dark py-3 text-white"
        >
          <FaSearch className="h-4 w-4" />
          <span>Search</span>
        </button>
      </form>
    </SectionContainer>
  );
};

export default Searchbar;
