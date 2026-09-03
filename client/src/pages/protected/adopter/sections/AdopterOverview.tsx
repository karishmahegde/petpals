import useAuthStore from "../../../../logic/store/useAuthStore";
import DashboardHeading from "../../../../components/ui/DashboardHeading";
import { getGreeting } from "../../../../logic/utils/datetime";

// Landing / overview section of the adopter dashboard.
const AdopterOverview = () => {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <DashboardHeading
        title={`${getGreeting()}, ${firstName}`}
        emoji="🌤️"
        message="Everything your pet needs, in one place"
        showDate
      />

      {/* Overview widgets to follow */}
    </div>
  );
};

export default AdopterOverview;
