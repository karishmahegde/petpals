import { useState } from "react";
import { FaChevronDown, FaDna } from "react-icons/fa";
import { BiFilterAlt } from "react-icons/bi";
import { PiBirdBold, PiRuler } from "react-icons/pi";
import { TbCake } from "react-icons/tb";
import type { Species, Breed, Shelter } from "../../../logic/api/petsApi";
import type { Filters } from "./PetCatalog";
import Card from "../../../components/ui/Card";
import {
  CheckboxDropdown,
  Pill,
  type FilterOption,
} from "../../../components/ui/FilterControls";
import ShelterLocationFilter from "./ShelterLocationFilter";

const SIZE_OPTIONS = ["Small", "Medium", "Large"];

interface PetFilterBarProps {
  filters: Filters;
  updateFilters: (partial: Partial<Filters>) => void;
  speciesOptions: Species[];
  breedOptions: Breed[];
  shelterOptions: Shelter[];
  onFindNearby: (
    location: { lat: number; lng: number } | { postalCode: string },
    radius: number,
  ) => void;
  isFindingNearby: boolean;
  nearbySearchEmpty: boolean;
  nearbySearchErrorMessage: string | null;
  onResetLocationFilter: () => void;
  isAgeRangeInvalid: boolean;
}

const PetFilterBar = ({
  filters,
  updateFilters,
  speciesOptions,
  breedOptions,
  shelterOptions,
  onFindNearby,
  isFindingNearby,
  nearbySearchEmpty,
  nearbySearchErrorMessage,
  onResetLocationFilter,
  isAgeRangeInvalid,
}: PetFilterBarProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSpecies = (speciesID: number) => {
    const speciesIDs = filters.speciesIDs.includes(speciesID)
      ? filters.speciesIDs.filter((id) => id !== speciesID)
      : [...filters.speciesIDs, speciesID];

    // A breed selection tied to a now-changed species set no longer makes sense.
    updateFilters({ speciesIDs, breedNames: [] });
  };

  const toggleBreed = (breedName: string) => {
    const breedNames = filters.breedNames.includes(breedName)
      ? filters.breedNames.filter((name) => name !== breedName)
      : [...filters.breedNames, breedName];
    updateFilters({ breedNames });
  };

  const toggleSize = (size: string) => {
    const sizes = filters.size.includes(size)
      ? filters.size.filter((s) => s !== size)
      : [...filters.size, size];
    updateFilters({ size: sizes });
  };

  const clearAge = () => updateFilters({ minAge: "", maxAge: "" });

  const speciesFilterOptions: FilterOption[] = speciesOptions.map((s) => ({
    value: s.speciesID,
    label: s.speciesName,
  }));
  const breedFilterOptions: FilterOption[] = breedOptions.map((b) => ({
    value: b.breedName,
    label: b.breedName,
  }));

  const agePillLabel =
    filters.minAge && filters.maxAge
      ? `${filters.minAge}-${filters.maxAge} mo`
      : filters.minAge
        ? `${filters.minAge}+ mo`
        : filters.maxAge
          ? `Up to ${filters.maxAge} mo`
          : "";

  const hasPills =
    filters.speciesIDs.length > 0 ||
    filters.breedNames.length > 0 ||
    filters.size.length > 0 ||
    filters.minAge !== "" ||
    filters.maxAge !== "";

  return (
    <Card className="mb-8 p-6">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <BiFilterAlt className="text-neutral-charcoal" />
          <h2 className="text-lg font-bold text-neutral-dark">Filters</h2>
        </span>
        <FaChevronDown
          className={`text-neutral-gray transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <CheckboxDropdown
              icon={<FaDna className="text-neutral-gray" />}
              label="Species"
              placeholder="All Species"
              options={speciesFilterOptions}
              selectedValues={filters.speciesIDs}
              onToggle={(value) => toggleSpecies(value as number)}
            />

            <CheckboxDropdown
              icon={<PiBirdBold className="text-neutral-gray" />}
              label="Breed"
              placeholder="All Breeds"
              options={breedFilterOptions}
              selectedValues={filters.breedNames}
              onToggle={(value) => toggleBreed(value as string)}
              disabled={filters.speciesIDs.length === 0}
              disabledMessage="Select a species first."
            />

            <CheckboxDropdown
              icon={<PiRuler className="text-neutral-gray" />}
              label="Size"
              placeholder="Any Size"
              options={SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
              selectedValues={filters.size}
              onToggle={(value) => toggleSize(value as string)}
            />

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-charcoal">
                <TbCake className="text-neutral-gray" />
                Age
              </label>
              <div className="flex items-center gap-2 rounded-md border border-neutral-lightgray bg-white px-3 py-2.5">
                <input
                  id="minAge"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={filters.minAge}
                  onChange={(e) => updateFilters({ minAge: e.target.value })}
                  aria-label="Minimum age in months"
                  className="w-full min-w-0 border-none p-0 text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-0"
                />
                <span className="text-neutral-gray">–</span>
                <input
                  id="maxAge"
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={filters.maxAge}
                  onChange={(e) => updateFilters({ maxAge: e.target.value })}
                  aria-label="Maximum age in months"
                  className="w-full min-w-0 border-none p-0 text-sm text-neutral-charcoal placeholder:italic placeholder:text-neutral-gray focus:outline-none focus:ring-0"
                />
              </div>
              {isAgeRangeInvalid && (
                <p className="mt-1 text-xs text-rose-dark">
                  Min age should be less than or equal to max age.
                </p>
              )}
            </div>
          </div>

          {hasPills && (
            <div className="mt-5 flex flex-wrap gap-2">
              {filters.speciesIDs.map((id) => {
                const name =
                  speciesOptions.find((s) => s.speciesID === id)?.speciesName ??
                  String(id);
                return (
                  <Pill
                    key={`species-${id}`}
                    label={name}
                    variant="species"
                    onRemove={() => toggleSpecies(id)}
                  />
                );
              })}
              {filters.breedNames.map((name) => (
                <Pill
                  key={`breed-${name}`}
                  label={name}
                  variant="breed"
                  onRemove={() => toggleBreed(name)}
                />
              ))}
              {filters.size.map((size) => (
                <Pill
                  key={`size-${size}`}
                  label={size}
                  variant="size"
                  onRemove={() => toggleSize(size)}
                />
              ))}
              {(filters.minAge !== "" || filters.maxAge !== "") && (
                <Pill label={agePillLabel} variant="age" onRemove={clearAge} />
              )}
            </div>
          )}

          <ShelterLocationFilter
            shelterOptions={shelterOptions}
            selectedShelterIDs={filters.selectedShelterIDs}
            onSelectedShelterIDsChange={(ids) =>
              updateFilters({ selectedShelterIDs: ids })
            }
            nearbyShelterIDs={filters.nearbyShelterIDs}
            onNearbyShelterIDsChange={(ids) =>
              updateFilters({ nearbyShelterIDs: ids })
            }
            onFindNearby={onFindNearby}
            isFindingNearby={isFindingNearby}
            nearbySearchEmpty={nearbySearchEmpty}
            nearbySearchErrorMessage={nearbySearchErrorMessage}
            onResetLocationFilter={onResetLocationFilter}
          />
        </>
      )}
    </Card>
  );
};

export default PetFilterBar;
