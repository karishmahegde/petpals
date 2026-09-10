// FavoritesFilterBar.tsx
// Lightweight, entirely client-side filtering for the Favorites section. Unlike
// the public catalog's PetFilterBar (a two-step network chain over
// species/breed/shelter/location/age), the favorites list is already loaded and
// small — so this just narrows the array in memory: Species + Breed + Sort,
// with the dropdown options derived from the favorites themselves.
import { useMemo } from "react";
import { BiFilterAlt } from "react-icons/bi";
import { FaDna } from "react-icons/fa";
import { PiBirdBold } from "react-icons/pi";
import { TbArrowsSort } from "react-icons/tb";
import Card from "../../../../../components/ui/Card";
import {
  CheckboxDropdown,
  Pill,
} from "../../../../../components/ui/pets/FilterControls";
import type { PetDetail } from "../../../../../logic/api/petsApi";

export type FavoritesSort = "name-asc" | "name-desc" | "available-first";

export interface FavoritesFilters {
  species: string[];
  breeds: string[];
  sort: FavoritesSort;
}

const SORT_LABELS: Record<FavoritesSort, string> = {
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "available-first": "Available first",
};

const distinct = (values: string[]) => [...new Set(values)].sort();

interface FavoritesFilterBarProps {
  favorites: PetDetail[];
  filters: FavoritesFilters;
  onChange: (partial: Partial<FavoritesFilters>) => void;
}

const FavoritesFilterBar = ({
  favorites,
  filters,
  onChange,
}: FavoritesFilterBarProps) => {
  const speciesOptions = useMemo(
    () => distinct(favorites.map((p) => p.breed.speciesName)),
    [favorites],
  );

  // Breed options track the selected species (or all, when none picked).
  const breedOptions = useMemo(() => {
    const pool =
      filters.species.length === 0
        ? favorites
        : favorites.filter((p) =>
            filters.species.includes(p.breed.speciesName),
          );
    return distinct(pool.map((p) => p.breed.breedName));
  }, [favorites, filters.species]);

  const toggle = (key: "species" | "breeds", value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    // Dropping a species may orphan a breed selection — clear breeds too.
    if (key === "species") {
      onChange({
        species: next,
        breeds: filters.breeds.filter((b) =>
          favorites.some(
            (p) =>
              p.breed.breedName === b &&
              (next.length === 0 || next.includes(p.breed.speciesName)),
          ),
        ),
      });
    } else {
      onChange({ breeds: next });
    }
  };

  return (
    <Card className="mb-6 p-5 font-body">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-charcoal">
        <BiFilterAlt />
        Filters
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CheckboxDropdown
          icon={<PiBirdBold />}
          label="Species"
          placeholder="All species"
          options={speciesOptions.map((s) => ({ value: s, label: s }))}
          selectedValues={filters.species}
          onToggle={(v) => toggle("species", String(v))}
        />
        <CheckboxDropdown
          icon={<FaDna />}
          label="Breed"
          placeholder="All breeds"
          options={breedOptions.map((b) => ({ value: b, label: b }))}
          selectedValues={filters.breeds}
          onToggle={(v) => toggle("breeds", String(v))}
        />
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-charcoal">
            <TbArrowsSort />
            Sort By
          </label>
          <select
            value={filters.sort}
            onChange={(e) =>
              onChange({ sort: e.target.value as FavoritesSort })
            }
            className="w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 text-sm text-neutral-charcoal"
          >
            {(Object.keys(SORT_LABELS) as FavoritesSort[]).map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(filters.species.length > 0 || filters.breeds.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.species.map((s) => (
            <Pill
              key={`sp-${s}`}
              label={s}
              variant="species"
              onRemove={() => toggle("species", s)}
            />
          ))}
          {filters.breeds.map((b) => (
            <Pill
              key={`br-${b}`}
              label={b}
              variant="breed"
              onRemove={() => toggle("breeds", b)}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default FavoritesFilterBar;
