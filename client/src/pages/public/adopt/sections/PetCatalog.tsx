import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import {
  getPets,
  getSpecies,
  getBreeds,
  getShelters,
  getNearbyShelters,
  type PetFilters,
} from "../../../../logic/api/petsApi";
import CardComponent from "../../../../components/ui/PetCatalogCard";
import PetDetailsModal from "../../../../components/ui/PetDetailsModal";
import PetFilterBar from "./PetFilterBar";

const LIMIT = 20;

// Everything this page needs to track internally — broader than PetFilters
// (petsApi.ts), which only describes what gets sent to GET /pets. This
// includes fields other queries need too, e.g. speciesIDs is only used to
// fetch breeds (GET /breeds filters by ID, not name).
export interface Filters {
  speciesIDs: number[];
  breedNames: string[];
  size: string[];
  minAge: string;
  maxAge: string;
  // Two separate sources for shelter filtering, tracked independently since
  // they have different lifecycles (instant checkbox vs. async search
  // result) and are only merged together when building petFilters below.
  selectedShelterIDs: number[];
  nearbyShelterIDs: number[];
}

const INITIAL_FILTERS: Filters = {
  speciesIDs: [],
  breedNames: [],
  size: [],
  minAge: "",
  maxAge: "",
  selectedShelterIDs: [],
  nearbyShelterIDs: [],
};

// Only one of (lat+lng) or postalCode is ever populated per search, matching
// the mutually-exclusive resolution already happening in
// ShelterLocationFilter.
export interface NearbySearchParams {
  lat?: number;
  lng?: number;
  postalCode?: string;
  radius: number;
  // Increments on every "Find Nearby" click, even if lat/lng/radius are
  // unchanged from the last search. Without this, an identical search
  // object would produce an identical queryKey, and TanStack Query would
  // skip refetching entirely — seq guarantees the key is always new, so a
  // repeated click always actually re-runs the search.
  seq: number;
}

const PetCatalog = () => {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [nearbySearch, setNearbySearch] = useState<NearbySearchParams | null>(
    null,
  );
  // Owns which pet's modal is open — shared across every CardComponent in
  // the grid, so only one PetDetailsModal needs to be rendered page-wide.
  const [openId, setOpenId] = useState<number | null>(null);

  // Any filter change resets to page 1 — a filtered result set shouldn't
  // stay on, say, page 4 if that page no longer exists for the new filters.
  const updateFilters = (partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const handleFindNearby = (
    location: { lat: number; lng: number } | { postalCode: string },
    radius: number,
  ) => {
    setNearbySearch((prev) => ({
      ...location,
      radius,
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  // Clears the nearby search itself (so a stale empty result can't linger)
  // as well as nearbyShelterIDs — shared by ShelterLocationFilter's "Reset
  // Filter" button and the empty-state "reset the location filter" link
  // below, so both stay in sync.
  const resetLocationFilter = () => {
    setNearbySearch(null);
    updateFilters({ nearbyShelterIDs: [] });
  };

  useEffect(() => {
    const speciesID = searchParams.get("speciesID");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const postalCode = searchParams.get("postalCode");
    const petID = searchParams.get("petID"); // auto-open via ?petID=...

    if (speciesID) {
      updateFilters({ speciesIDs: [Number(speciesID)] });
    } else if (lat && lng) {
      setNearbySearch({
        lat: Number(lat),
        lng: Number(lng),
        radius: 25,
        seq: 1,
      });
    } else if (postalCode) {
      setNearbySearch({ postalCode, radius: 25, seq: 1 });
    }

    if (petID) {
      setOpenId(Number(petID));
    }
    // Intentionally run once, on mount only — this seeds initial state
    // from a Home-page handoff, not something that should re-run on
    // every filters/nearbySearch change afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Independent data, no prerequisites — fetches immediately on page load.
  const { data: species = [] } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
  });

  // Cascading: only runs once at least one species is selected. Without
  // `enabled`, this would fire with an empty speciesIDs array before the
  // user has chosen anything.
  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds", filters.speciesIDs],
    queryFn: () => getBreeds(filters.speciesIDs),
    enabled: filters.speciesIDs.length > 0,
  });

  // Independent data, no prerequisites — fetches immediately on page load.
  const { data: shelters = [] } = useQuery({
    queryKey: ["shelters"],
    queryFn: getShelters,
  });

  // Only runs after "Find Nearby Shelters" is clicked (nearbySearch is set).
  // Stays idle (enabled: false) until then.
  const {
    data: nearbySheltersResult,
    isFetching: isFindingNearby,
    isError: isNearbyError,
    isSuccess: isNearbySuccess,
    error: nearbyError,
  } = useQuery({
    queryKey: ["shelters-nearby", nearbySearch],
    queryFn: () => getNearbyShelters(nearbySearch!),
    enabled: nearbySearch !== null,
  });

  // Backend-reported failure for the nearby search itself (e.g. postal code
  // not found) — surfaced separately from the generic error box so it can be
  // shown right next to the zip input in ShelterLocationFilter.
  const nearbySearchErrorMessage =
    isNearbyError &&
    axios.isAxiosError(nearbyError) &&
    nearbyError.response?.data?.message
      ? nearbyError.response.data.message
      : null;

  // queryFn's job is only to fetch data — updating filters is a separate
  // concern, so it's handled here via useEffect (watch for the query
  // succeeding, then react to it) rather than inside queryFn itself.
  useEffect(() => {
    if (isNearbySuccess && nearbySheltersResult.length > 0) {
      updateFilters({
        nearbyShelterIDs: nearbySheltersResult.map((s) => s.shelterID),
      });
    }
    // An empty result is intentionally not committed — nearbyShelterIDs
    // stays as-is, and ShelterLocationFilter shows its own empty message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbySheltersResult, isNearbySuccess]);

  // True only when a nearby search just completed successfully but found
  // zero shelters — used to show a distinct "no shelters found" message,
  // separate from the main pets-empty-state message.
  const nearbySearchEmpty =
    nearbySearch !== null &&
    isNearbySuccess &&
    nearbySheltersResult.length === 0;

  const isAgeRangeInvalid =
    filters.minAge !== "" &&
    filters.maxAge !== "" &&
    Number(filters.minAge) > Number(filters.maxAge);

  // Union of manually-picked and nearby-found shelters, deduplicated (a
  // shelter could appear in both). IN queries handle duplicates fine on
  // their own, but deduping keeps the request payload clean.
  const mergedShelterIDs = [
    ...new Set([...filters.selectedShelterIDs, ...filters.nearbyShelterIDs]),
  ];

  // Translates internal Filters state down into exactly what GET /pets
  // expects. Empty arrays/strings become undefined so unused filters are
  // omitted from the request entirely, rather than sent as empty values.
  // If a nearby search just completed with zero results AND no shelter is
  // manually selected either, force an impossible shelter ID so the pets
  // query correctly returns nothing — distinct from mergedShelterIDs being
  // empty because no shelter filter was ever applied at all.
  const petFilters: PetFilters = {
    speciesID: filters.speciesIDs.length > 0 ? filters.speciesIDs : undefined,
    breedName: filters.breedNames.length > 0 ? filters.breedNames : undefined,
    size: filters.size.length > 0 ? filters.size : undefined,
    minAge: filters.minAge || undefined,
    maxAge: filters.maxAge || undefined,
    shelterID:
      nearbySearchEmpty && filters.selectedShelterIDs.length === 0
        ? [-1]
        : mergedShelterIDs.length > 0
          ? mergedShelterIDs
          : undefined,
  };

  const {
    data: petsResult,
    isLoading,
    isError,
    error,
  } = useQuery({
    // Keyed on petFilters, not filters — petFilters is what queryFn
    // actually consumes, and it can change (e.g. the [-1] override above)
    // even when filters itself doesn't, since it also depends on
    // nearbySearchEmpty. Keying on filters alone meant TanStack Query
    // sometimes saw an identical key and skipped refetching even though
    // the real query input had changed.
    queryKey: ["pets", page, petFilters],
    queryFn: () => getPets(petFilters, page, LIMIT),
    // Keeps showing the previous page's pets while a new query loads,
    // instead of clearing to the loading skeleton on every filter/page
    // change — avoids a jarring flash on every small interaction.
    placeholderData: keepPreviousData,
    // Wait until any in-flight nearby-shelter search has finished (success
    // or failure) before fetching pets — otherwise this could run with
    // stale nearbyShelterIDs from before the search completed.
    enabled: !isFindingNearby && !isNearbyError && !isAgeRangeInvalid,
  });

  const pets = petsResult?.data ?? [];
  const pagination = petsResult?.pagination;

  // Priority order: if the nearby-shelter search itself failed, that's the
  // relevant error (the pets query never even ran in that case, per the
  // enabled condition above). Otherwise, fall back to the pets query's own
  // error, using the backend's real message if available.
  const errorMessage = isNearbyError
    ? "Failed to find nearby shelters."
    : axios.isAxiosError(error) && error.response?.data?.message
      ? error.response.data.message
      : "Failed to load pets.";

  return (
    <div id="pets" className="bg-neutral-offwhite py-14 px-6 font-body">
      <div className="text-center">
        <h1 className="lg:text-4xl text-3xl font-bold text-black mb-4">
          Pet Catalog 🐶
        </h1>
        <p>Warning! ⚠️ Extreme cuteness ahead 🥰</p>
      </div>

      <div className="mt-10 max-w-6xl mx-auto">
        {/* Presentational only — owns no state of its own, receives data via
            props and reports changes back up via updateFilters/onFindNearby */}
        <PetFilterBar
          filters={filters}
          updateFilters={updateFilters}
          speciesOptions={species}
          breedOptions={breeds}
          shelterOptions={shelters}
          onFindNearby={handleFindNearby}
          isFindingNearby={isFindingNearby}
          nearbySearchEmpty={nearbySearchEmpty}
          nearbySearchErrorMessage={nearbySearchErrorMessage}
          onResetLocationFilter={resetLocationFilter}
          isAgeRangeInvalid={isAgeRangeInvalid}
          nearbySearch={nearbySearch}
        />

        <div>
          {/* Two independent failure sources share one error box */}
          {(isError || isNearbyError) && (
            <div className="mx-6 my-6 rounded-md bg-rose-light p-4 text-rose-dark">
              {errorMessage}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-lg bg-neutral-offwhite animate-pulse"
                />
              ))}
            </div>
          ) : pets.length === 0 ? (
            <p className="text-center text-neutral-gray py-12">
              {nearbySearchEmpty && filters.selectedShelterIDs.length === 0 ? (
                <>
                  No shelters found near that location — try a wider radius or{" "}
                  <button
                    type="button"
                    onClick={resetLocationFilter}
                    className="underline"
                  >
                    reset the location filter
                  </button>
                  .
                </>
              ) : (
                "No pets match your filters yet — try widening your search."
              )}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-9">
                {pets.map((pet) => (
                  <CardComponent
                    key={pet.petID}
                    pet={pet}
                    openId={openId}
                    onKnowMore={(petID) => setOpenId(petID)}
                  />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-neutral-charcoal">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PetDetailsModal petID={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

export default PetCatalog;
