// FavoritesWidget.tsx
// "Favorites" preview widget on the adopter Overview page — sits next to
// the Appointments widget, same fixed height. "Know More" reuses the same
// PetDetailsModal already used on /adopt, opened via the page-owned openId
// state passed down as onKnowMore — this widget never keeps its own
// competing copy of "which pet is open" (State Ownership Rule).
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import PetCatalogCard from "../../../../../../components/ui/pets/PetCatalogCard";
import { getMyFavorites } from "../../../../../../logic/api/adoptersApi";

interface FavoritesWidgetProps {
  openId: number | null;
  onKnowMore: (petID: number) => void;
}

const FavoritesWidget = ({ openId, onKnowMore }: FavoritesWidgetProps) => {
  const { data: favorites, isLoading } = useQuery({
    queryKey: ["adopter", "favorites"],
    queryFn: getMyFavorites,
  });

  return (
    <OverviewWidgetCard
      icon="❤️"
      title="Favorites"
      action={{ label: "View All", to: "/adopter/favorites" }}
      className="h-96 flex-1"
      isLoading={isLoading}
      isEmpty={!favorites || favorites.length === 0}
      emptyMessage="No favorites yet. tap the heart on a pet you love!"
      emptyAction={
        <ButtonElement to="/adopt" className="bg-teal-dark hover:brightness-95">
          Explore Pets
        </ButtonElement>
      }
    >
      <div className="flex flex-col items-center gap-4 sm:h-full sm:flex-row sm:items-start">
        {(favorites ?? []).map((pet) => (
          <div key={pet.petID} className="w-40 p-1 shrink-0">
            <PetCatalogCard
              pet={pet}
              openId={openId}
              onKnowMore={onKnowMore}
              unavailable={pet.adoptionStatus !== "available"}
            />
          </div>
        ))}
      </div>
    </OverviewWidgetCard>
  );
};

export default FavoritesWidget;
