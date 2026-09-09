// PetsWidget.tsx
// "My Pets" preview widget on the adopter Overview page — sits next to the
// stat-tile widget, same fixed height. Reuses PetCatalogCard (same as
// FeaturedPets.tsx and FavoritesWidget.tsx) instead of its own card markup —
// a fun prompt to go adopt one when there are none yet.
import { useQuery } from "@tanstack/react-query";
import Card from "../../../../../components/ui/Card";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../components/ui/dashboard/DashboardEmptyMessage";
import PetCatalogCard from "../../../../../components/ui/pets/PetCatalogCard";
import { getMyAdoptedPets } from "../../../../../logic/api/adoptersApi";

interface PetsWidgetProps {
  openId: number | null;
  onKnowMore: (petID: number) => void;
}

const PetsWidget = ({ openId, onKnowMore }: PetsWidgetProps) => {
  const { data: pets, isLoading } = useQuery({
    queryKey: ["adopter", "adopted-pets"],
    queryFn: getMyAdoptedPets,
  });

  return (
    <Card className="flex h-[356px] flex-1 flex-col p-5">
      <DashboardWidgetHeader
        icon="🐶"
        title="My Pets"
        action={{ label: "View All", to: "/adopter/pets" }}
      />

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}

        {!isLoading && (!pets || pets.length === 0) && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <DashboardEmptyMessage>
              No pets yet, your future best friend is out there! 🐾
            </DashboardEmptyMessage>
            <ButtonElement
              to="/adopt"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              Explore Pets
            </ButtonElement>
          </div>
        )}

        {!isLoading && pets && pets.length > 0 && (
          <div className="flex flex-col items-center gap-4 sm:h-full sm:flex-row sm:items-start">
            {pets.map((pet) => (
              <div key={pet.petID} className="w-40 p-1 shrink-0">
                <PetCatalogCard
                  pet={pet}
                  openId={openId}
                  onKnowMore={onKnowMore}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PetsWidget;
