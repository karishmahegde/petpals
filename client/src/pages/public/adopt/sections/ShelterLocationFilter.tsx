import { useState } from "react";
import { FiHome } from "react-icons/fi";
import { HiOutlineLocationMarker } from "react-icons/hi";
import { FaCheckCircle } from "react-icons/fa";
import type { Shelter } from "../../../../logic/api/petsApi";
import type { NearbySearchParams } from "./PetCatalog";
import {
  CheckboxDropdown,
  Dropdown,
  Pill,
  type FilterOption,
} from "../../../../components/ui/FilterControls";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 250];
const DEFAULT_RADIUS = 25;

interface ShelterLocationFilterProps {
  shelterOptions: Shelter[];
  selectedShelterIDs: number[];
  onSelectedShelterIDsChange: (ids: number[]) => void;
  nearbyShelterIDs: number[];
  onNearbyShelterIDsChange: (ids: number[]) => void;
  onFindNearby: (
    location: { lat: number; lng: number } | { postalCode: string },
    radius: number,
  ) => void;
  isFindingNearby: boolean;
  nearbySearchEmpty: boolean;
  nearbySearchErrorMessage: string | null;
  onResetLocationFilter: () => void;
  nearbySearch: NearbySearchParams | null;
}

const ShelterLocationFilter = ({
  shelterOptions,
  selectedShelterIDs,
  onSelectedShelterIDsChange,
  nearbyShelterIDs,
  onNearbyShelterIDsChange,
  onFindNearby,
  isFindingNearby,
  nearbySearchErrorMessage,
  onResetLocationFilter,
  nearbySearch,
}: ShelterLocationFilterProps) => {
  const [isDistanceOpen, setIsDistanceOpen] = useState(false);
  const [pendingRadius, setPendingRadius] = useState(DEFAULT_RADIUS);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState("");

  // Only meaningful once a zip-based search has actually run — a backend
  // error from a lat/lng search shouldn't be misattributed to the zip input.
  const zipError = nearbySearch?.postalCode ? nearbySearchErrorMessage : null;

  const toggleShelter = (shelterID: number) => {
    const ids = selectedShelterIDs.includes(shelterID)
      ? selectedShelterIDs.filter((id) => id !== shelterID)
      : [...selectedShelterIDs, shelterID];
    onSelectedShelterIDsChange(ids);
  };

  // Mirrors toggleShelter's filter-out pattern, but only ever removes —
  // nearby-sourced options are never manually added, only found by a search.
  const toggleNearbyShelter = (shelterID: number) => {
    onNearbyShelterIDsChange(nearbyShelterIDs.filter((id) => id !== shelterID));
  };

  const shelterFilterOptions: FilterOption[] = shelterOptions.map((s) => ({
    value: s.shelterID,
    label: s.shelterName,
  }));

  const runSearch = (
    location: { lat: number; lng: number } | { zip: string },
  ) => {
    if ("zip" in location) {
      onFindNearby({ postalCode: location.zip }, pendingRadius);
    } else {
      onFindNearby(location, pendingRadius);
    }
    setIsDistanceOpen(false);
  };

  // Populates coords (or geoError on failure) only — the actual search is
  // triggered separately via the "Find Nearby Shelters" button, so a failed
  // attempt here never blocks a subsequent zip-based search.
  const handleGeolocateClick = () => {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("Location isn't supported by this browser.");
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
      },
      () => {
        setIsLocating(false);
        setGeoError(
          "Couldn't get your location. Check permissions and try again.",
        );
      },
    );
  };

  // Priority resolution: a prior successful geolocation always wins over
  // zip input, even if the zip field also has text.
  const handleFindNearby = () => {
    if (coords) {
      runSearch(coords);
    } else if (/^\d{5}$/.test(zipInput)) {
      runSearch({ zip: zipInput });
    }
  };

  // Resets only the location/zip search — selectedShelterIDs (manually
  // picked shelters) are left untouched.
  const handleResetFilter = () => {
    setZipInput("");
    setPendingRadius(DEFAULT_RADIUS);
    setCoords(null);
    setGeoError(null);
    onResetLocationFilter();
  };

  const isSearching = isLocating || isFindingNearby;

  const nearbyLabel = nearbySearch?.postalCode
    ? `Based on Zip ${nearbySearch.postalCode}: ${nearbySearch.radius} km`
    : `Based on current location: ${nearbySearch?.radius} km`;

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CheckboxDropdown
          icon={<FiHome className="text-neutral-gray" />}
          label="Shelter"
          placeholder="All Shelters"
          options={shelterFilterOptions}
          selectedValues={selectedShelterIDs}
          onToggle={(value) => toggleShelter(value as number)}
          nearbyValues={nearbyShelterIDs}
          onToggleNearby={(value) => toggleNearbyShelter(value as number)}
          nearbyBadgeLabel="Nearby"
        />

        <Dropdown
          icon={<HiOutlineLocationMarker className="text-neutral-gray" />}
          label="Distance"
          triggerText={
            nearbyShelterIDs.length > 0 ? nearbyLabel : "Any Distance"
          }
          isPlaceholder={nearbyShelterIDs.length === 0}
          open={isDistanceOpen}
          onOpenChange={setIsDistanceOpen}
        >
          <div className="flex flex-col gap-1.5 p-1">
            {RADIUS_OPTIONS.map((radius) => (
              <label
                key={radius}
                className="flex items-center gap-1.5 rounded px-1 py-1 text-sm text-neutral-charcoal hover:bg-neutral-offwhite"
              >
                <input
                  type="radio"
                  name="radius"
                  checked={pendingRadius === radius}
                  onChange={() => setPendingRadius(radius)}
                  className="accent-teal-dark"
                />
                {radius} km
              </label>
            ))}

            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={handleGeolocateClick}
                aria-label="Use current location"
                title="Use current location"
                className="flex flex-1 shrink-0 items-center justify-center rounded-md ext-xs bg-teal p-2 text-teal-dark hover:bg-teal-dark hover:text-white"
              >
                <HiOutlineLocationMarker className="mx-1" />
                <span className="text-xs font-normal">
                  {coords !== null ? (
                    <span className="inline-flex items-center gap-1">
                      Location obtained{" "}
                      <FaCheckCircle className="text-green-500" />
                    </span>
                  ) : (
                    "Use current location"
                  )}
                </span>
              </button>

              <p className="text-xs mx-2">OR</p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Zip code"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                aria-label="Zip code"
                className="w-full flex-1 min-w-0 rounded-md border border-neutral-lightgray bg-white px-2 py-1.5 text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-1 focus:ring-teal-dark"
              />
            </div>

            {geoError && <p className="text-xs text-rose-dark">{geoError}</p>}
            {zipError && <p className="text-xs text-rose-dark">{zipError}</p>}

            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleFindNearby}
                disabled={
                  !(coords !== null || /^\d{5}$/.test(zipInput)) || isSearching
                }
                className="w-full rounded-md bg-gold px-3 py-1.5 text-xs font-light text-black disabled:bg-neutral-gray"
              >
                {isSearching ? "Searching…" : "Find Nearby Shelters"}
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="w-full rounded-md bg-neutral-offwhite border border-neutral-lightgray px-3 py-1.5 text-xs font-light text-neutral-charcoal hover:bg-neutral-lightgray"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </Dropdown>
      </div>

      {(selectedShelterIDs.length > 0 || nearbyShelterIDs.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedShelterIDs.map((id) => {
            const name =
              shelterOptions.find((s) => s.shelterID === id)?.shelterName ??
              String(id);
            return (
              <Pill
                key={`shelter-${id}`}
                label={name}
                variant="shelter"
                onRemove={() => toggleShelter(id)}
              />
            );
          })}
          {nearbyShelterIDs.length > 0 && (
            <Pill
              label={nearbyLabel}
              variant="location"
              onRemove={handleResetFilter}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ShelterLocationFilter;
