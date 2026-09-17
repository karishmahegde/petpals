// PetsWidget.tsx
// "My Pets" preview widget on the adopter Overview page — sits next to the
// stat-tile widget, same fixed height. Reuses PetCatalogCard (same as
// FeaturedPets.tsx and FavoritesWidget.tsx) instead of its own card markup —
// a fun prompt to go adopt one when there are none yet.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import PetCatalogCard from "../../../../../../components/ui/pets/PetCatalogCard";
import { getMyAdoptedPets } from "../../../../../../logic/api/adoptersApi";

// Unlike FavoritesWidget, "My Pets" cards don't open the public PetDetailsModal.
// "View Details" routes into the My Pets tab, which (next) reads ?petID and
// opens the side panel for that pet.
const PetsWidget = () => {
  const navigate = useNavigate();
  const { data: pets, isLoading } = useQuery({
    queryKey: ["adopter", "adopted-pets"],
    queryFn: getMyAdoptedPets,
  });

  return (
    <OverviewWidgetCard
      icon="🐶"
      title="My Pets"
      action={{ label: "View All", to: "/adopter/pets" }}
      className="h-[356px] flex-1"
      isLoading={isLoading}
      isEmpty={!pets || pets.length === 0}
      emptyMessage="No pets yet, your future best friend is out there! 🐾"
      emptyAction={
        <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
          Explore Pets
        </ButtonElement>
      }
    >
      <div className="flex flex-col items-center gap-4 sm:h-full sm:flex-row sm:items-start">
        {(pets ?? []).map((pet) => (
          <div key={pet.petID} className="w-40 p-1 shrink-0">
            <PetCatalogCard
              pet={pet}
              openId={null}
              ctaLabel="View Details"
              onKnowMore={(petID) => navigate(`/adopter/pets?petID=${petID}`)}
            />
          </div>
        ))}
      </div>
    </OverviewWidgetCard>
  );
};

export default PetsWidget;
