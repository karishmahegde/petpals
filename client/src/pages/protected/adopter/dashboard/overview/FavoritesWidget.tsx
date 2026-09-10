// FavoritesWidget.tsx
// "Favorites" preview widget on the adopter Overview page — sits next to
// the Appointments widget, same fixed height. "Know More" reuses the same
// PetDetailsModal already used on /adopt, opened via the page-owned openId
// state passed down as onKnowMore — this widget never keeps its own
// competing copy of "which pet is open" (State Ownership Rule).
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../components/ui/dashboard/DashboardEmptyMessage";
import PetCatalogCard from "../../../../../components/ui/pets/PetCatalogCard";
import { getMyFavorites } from "../../../../../logic/api/adoptersApi";

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
    <Card className="flex h-96 flex-1 flex-col p-5">
      <DashboardWidgetHeader
        icon="❤️"
        title="Favorites"
        action={{ label: "View All", to: "/adopter/favorites" }}
      />

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}

        {!isLoading && (!favorites || favorites.length === 0) && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <DashboardEmptyMessage>
              No favorites yet. tap the heart on a pet you love!
            </DashboardEmptyMessage>
            <ButtonElement
              to="/adopt"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              Explore Pets
            </ButtonElement>
          </div>
        )}

        {!isLoading && favorites && favorites.length > 0 && (
          <div className="flex flex-col items-center gap-4 sm:h-full sm:flex-row sm:items-start">
            {favorites.map((pet) => (
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
        )}
      </div>
    </Card>
  );
};

export default FavoritesWidget;
