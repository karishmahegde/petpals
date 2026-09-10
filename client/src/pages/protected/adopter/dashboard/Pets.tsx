import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Card from "../../../../components/ui/Card";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import PetCatalogCard from "../../../../components/ui/pets/PetCatalogCard";
import PetDetailPanel from "./pets/PetDetailPanel";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import { getMyAdoptedPets } from "../../../../logic/api/adoptersApi";

// "My Pets" section of the adopter dashboard. Owns the pet-details open state
// (State Ownership Rule) — the cards below only report up via onKnowMore, and
// PetDetailPanel just renders what it's handed.
// Entry from the Overview "My Pets" widget deep-links via ?petID=X, read once
// on mount here (URL-reading lives in the page, same as PetCatalog.tsx).
const Pets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openPetId, setOpenPetId] = useState<number | null>(() => {
    const petID = Number(searchParams.get("petID"));
    return Number.isInteger(petID) && petID > 0 ? petID : null;
  });

  useEffect(() => {
    if (searchParams.has("petID")) {
      searchParams.delete("petID");
      setSearchParams(searchParams, { replace: true });
    }
    // Run once on mount — the initial state above already captured the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    data: adoptedPets,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["adopter", "adopted-pets"],
    queryFn: getMyAdoptedPets,
  });

  return (
    <div>
      <DashboardHeading
        title="My Pets"
        emoji="🐾"
        message="Everything about your companions"
      />

      <div className="flex flex-col gap-6">
        {/* ———————————————— ADOPTED PETS ———————————————— */}
        <Card className="p-6">
          <DashboardWidgetHeader icon="🏠" title="Adopted Pets" />

          {isLoading && (
            <p className="font-body text-sm text-neutral-gray">
              Loading your pets…
            </p>
          )}

          {isError && (
            <p className="font-body text-sm text-rose-dark">
              Couldn't load your pets. Please try again.
            </p>
          )}

          {!isLoading &&
            !isError &&
            (!adoptedPets || adoptedPets.length === 0) && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <DashboardEmptyMessage>
                  You have not adopted any pets yet.
                </DashboardEmptyMessage>
                <ButtonElement
                  to="/adopt"
                  className="bg-teal-dark hover:bg-gold-dark"
                >
                  Explore Pets
                </ButtonElement>
              </div>
            )}

          {adoptedPets && adoptedPets.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {adoptedPets.map((pet) => (
                <div key={pet.petID} className="w-44 shrink-0">
                  <PetCatalogCard
                    pet={pet}
                    openId={openPetId}
                    ctaLabel="View Details"
                    onKnowMore={setOpenPetId}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ———————————————— FOSTERED PETS ———————————————— */}
        {/* Fostering isn't a built feature yet — static empty state for now. */}
        <Card className="p-6">
          <DashboardWidgetHeader icon="🌱" title="Fostered Pets" />

          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <DashboardEmptyMessage>
              You have not fostered any pets yet.
            </DashboardEmptyMessage>
            <ButtonElement
              to="/adopt"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              Explore Pets
            </ButtonElement>
          </div>
        </Card>
      </div>

      <PetDetailPanel petID={openPetId} onClose={() => setOpenPetId(null)} />
    </div>
  );
};

export default Pets;
