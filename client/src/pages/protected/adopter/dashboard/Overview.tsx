import { useState } from "react";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import PetDetailsModal from "../../../../components/ui/pets/PetDetailsModal";
import StatsWidget from "./overview/StatsWidget";
import PetsWidget from "./overview/PetsWidget";
import AppointmentsWidget from "./overview/AppointmentsWidget";
import FavoritesWidget from "./overview/FavoritesWidget";
import ApplicationsWidget from "./overview/ApplicationsWidget";
import VisitsWidget from "./overview/VisitsWidget";
import { getGreeting } from "../../../../logic/utils/datetime";

// Landing / overview section of the adopter dashboard.
const Overview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Owned here (the page), not by FavoritesWidget — same PetDetailsModal
  // already used on /adopt, matching the State Ownership Rule.
  const [openPetId, setOpenPetId] = useState<number | null>(null);

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji="🌤️"
        message="Everything your pet needs, in one place"
        showDate
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <StatsWidget />
        <PetsWidget openId={openPetId} onKnowMore={setOpenPetId} />
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <AppointmentsWidget />
        <FavoritesWidget openId={openPetId} onKnowMore={setOpenPetId} />
      </div>

      {/* Applications and Visits — side by side on lg, equal width and
          height (the taller card sets the height, via the default stretch) */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <ApplicationsWidget />
        <VisitsWidget />
      </div>

      <PetDetailsModal petID={openPetId} onClose={() => setOpenPetId(null)} />
    </div>
  );
};

export default Overview;
