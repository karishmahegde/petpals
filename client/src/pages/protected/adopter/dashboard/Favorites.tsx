import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PetCatalogCard from "../../../../components/ui/pets/PetCatalogCard";
import PetDetailsModal from "../../../../components/ui/pets/PetDetailsModal";
import { getMyFavorites } from "../../../../logic/api/adoptersApi";
import FavoritesFilterBar, {
  type FavoritesFilters,
} from "./favorites/FavoritesFilterBar";

const INITIAL_FILTERS: FavoritesFilters = {
  species: [],
  breeds: [],
  sort: "name-asc",
};

const isAvailable = (status: string) => status === "available";

// "Favorites" section of the adopter dashboard — works like the public catalog
// (cards + "Know More" opens the shared PetDetailsModal), but the list also
// includes pets that are no longer adoptable: those render dimmed with no
// "Know More", and can only be removed (via the card's heart).
const Favorites = () => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FavoritesFilters>(INITIAL_FILTERS);

  const { data: favorites, isLoading, isError } = useQuery({
    queryKey: ["adopter", "favorites"],
    queryFn: getMyFavorites,
  });

  const updateFilters = (partial: Partial<FavoritesFilters>) =>
    setFilters((prev) => ({ ...prev, ...partial }));

  const visible = useMemo(() => {
    let list = favorites ?? [];
    if (filters.species.length > 0) {
      list = list.filter((p) =>
        filters.species.includes(p.breed.speciesName),
      );
    }
    if (filters.breeds.length > 0) {
      list = list.filter((p) => filters.breeds.includes(p.breed.breedName));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (filters.sort === "name-desc")
        return b.petName.localeCompare(a.petName);
      if (filters.sort === "available-first") {
        const diff =
          Number(isAvailable(b.adoptionStatus)) -
          Number(isAvailable(a.adoptionStatus));
        if (diff !== 0) return diff;
      }
      return a.petName.localeCompare(b.petName);
    });
    return sorted;
  }, [favorites, filters]);

  return (
    <div>
      <DashboardHeading
        title="Favorites"
        emoji="❤️"
        message="Pets you've saved for later"
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">
          Loading your favorites…
        </p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your favorites. Please try again.
        </p>
      )}

      {favorites && favorites.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            No favorites yet. Tap the heart on a pet you love!
          </DashboardEmptyMessage>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Explore Pets
          </ButtonElement>
        </div>
      )}

      {favorites && favorites.length > 0 && (
        <>
          <FavoritesFilterBar
            favorites={favorites}
            filters={filters}
            onChange={updateFilters}
          />

          {visible.length === 0 ? (
            <DashboardEmptyMessage>
              No favorites match these filters.
            </DashboardEmptyMessage>
          ) : (
            <div className="flex flex-wrap gap-4">
              {visible.map((pet) => (
                <div key={pet.petID} className="w-44 shrink-0">
                  <PetCatalogCard
                    pet={pet}
                    openId={openId}
                    onKnowMore={setOpenId}
                    unavailable={!isAvailable(pet.adoptionStatus)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <PetDetailsModal petID={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

export default Favorites;
