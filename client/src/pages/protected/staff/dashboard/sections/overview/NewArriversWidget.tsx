// NewArriversWidget.tsx
// "New Arrivers" preview widget on the Staff Overview page — pets recently
// received but not yet available for adoption (adoptionStatus: "incoming"),
// newest intake first. Uses GET /staff/me/pets (already scoped server-side
// to the staff member's own shelter), not the public catalog — that
// endpoint is hardcoded to adoptionStatus=available, which would never
// include a genuinely new arrival. sort=newest is a Sprint 5.2 addition to
// this endpoint, see server/.../staff/pets.service.js. New pets start
// "incoming" (POST /pets's default), so every newly added pet lands here.
// "View All" leads to the Pets tab (its Incoming Pets section); "View
// Details" deep-links there via ?petID= to open that pet's panel, where
// staff can move it on to Available.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaPaw } from "react-icons/fa";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../../../components/ui/dashboard/DashboardList";
import { getMyShelterPets } from "../../../../../../logic/api/staffPetsApi";

const PREVIEW_LIMIT = 5;

const NewArriversWidget = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["staff", "new-arrivers", { limit: PREVIEW_LIMIT }],
    queryFn: () =>
      getMyShelterPets({
        adoptionStatus: "incoming",
        sort: "newest",
        limit: PREVIEW_LIMIT,
      }),
  });

  const pets = data?.data ?? [];

  return (
    <OverviewWidgetCard
      icon="🐶"
      title="New Arrivers"
      action={{ label: "View All", to: "/staff/pets" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={pets.length === 0}
      emptyMessage="No incoming pets right now"
    >
      <ul className="flex flex-col gap-4">
        {pets.map((pet) => (
          <li key={pet.petID}>
            <DashboardListRow
              className="bg-teal-light"
              leading={
                <RowMedallion
                  src={pet.petPhoto}
                  alt={`${pet.petName} photo`}
                  fallback={
                    <FaPaw className="h-6 w-6 text-teal-dark" aria-hidden />
                  }
                />
              }
              title={pet.petName}
              lines={[{ text: pet.breed.breedName }]}
              actions={
                <RowActionButton
                  onClick={() => navigate(`/staff/pets?petID=${pet.petID}`)}
                >
                  View Details
                </RowActionButton>
              }
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default NewArriversWidget;
