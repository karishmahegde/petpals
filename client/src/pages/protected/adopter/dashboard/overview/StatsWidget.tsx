// StatsWidget.tsx
// The 2x2 stat-tile square at the top-left of the adopter Overview page.
// Self-contained: owns its own count queries (React Query dedupes the shared
// keys with the cards below that read the same data).
import { useQuery } from "@tanstack/react-query";
import {
  PiBellBold,
  PiCalendarCheckBold,
  PiCatBold,
  PiClipboardTextBold,
} from "react-icons/pi";
import Card from "../../../../../components/ui/Card";
import StatTile from "../../../../../components/ui/dashboard/StatTile";
import {
  getMyAdoptedPets,
  getMyApplicationsCount,
} from "../../../../../logic/api/adoptersApi";

const StatsWidget = () => {
  const adoptedPetsQuery = useQuery({
    queryKey: ["adopter", "adopted-pets"],
    queryFn: getMyAdoptedPets,
  });
  const applicationsCountQuery = useQuery({
    queryKey: ["adopter", "applications-count"],
    queryFn: getMyApplicationsCount,
  });

  const petsCount = adoptedPetsQuery.data?.length;
  const applicationsCount = applicationsCountQuery.data;

  return (
    // Fixed 356x356 square — 2 tiles (144px) + gap (20px) + padding (24px each
    // side), both dimensions, always 2 columns x 2 rows regardless of viewport
    // (not just mobile).
    <Card className="h-[356px] w-[356px] shrink-0 p-6">
      <div className="grid grid-cols-2 gap-5">
        <StatTile
          icon={<PiCatBold />}
          value={petsCount ?? "—"}
          label={petsCount === 1 ? "My Pet" : "My Pets"}
          color="gold"
        />
        {/* Adopter-facing appointments aren't built yet (Sprint 5) — a real
            count replaces this once that endpoint exists. */}
        <StatTile
          icon={<PiCalendarCheckBold />}
          value={0}
          label="Appointments"
          color="teal"
        />
        <StatTile
          icon={<PiClipboardTextBold />}
          value={applicationsCount ?? "—"}
          label={applicationsCount === 1 ? "Application" : "Applications"}
          color="rose"
        />
        {/* No notification system exists yet anywhere in the app (see
            DashboardNavbar's hardcoded hasNotifications=false) — same
            placeholder treatment here. */}
        <StatTile
          icon={<PiBellBold />}
          value={0}
          label="Notifications"
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
