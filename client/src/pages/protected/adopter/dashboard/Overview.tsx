import { useState } from "react";
import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import PetDetailsModal from "../../../../components/ui/pets/PetDetailsModal";
import StatsWidget from "./sections/overview/StatsWidget";
import PetsWidget from "./sections/overview/PetsWidget";
import AppointmentsWidget from "./sections/overview/AppointmentsWidget";
import FavoritesWidget from "./sections/overview/FavoritesWidget";
import ApplicationsWidget from "./sections/overview/ApplicationsWidget";
import VisitsWidget from "./sections/overview/VisitsWidget";
import { getGreeting, getGreetingEmoji } from "../../../../logic/utils/datetime";

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
        emoji={getGreetingEmoji()}
        message="Everything your pet needs, in one place"
        showDate
      />

      {/* Side by side wherever My Pets still has room beside the fixed 356px
          stats square: sm (no sidebar yet) and lg up. md stacks, since the
          sidebar appears there and takes 288px of the width */}
      <div className="flex flex-col gap-6 sm:flex-row md:flex-col lg:flex-row">
        <StatsWidget />
        <PetsWidget />
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
