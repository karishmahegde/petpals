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
import Card from "../../../../../../components/ui/Card";
import StatTile from "../../../../../../components/ui/dashboard/StatTile";
import {
  getMyAdoptedPets,
  getMyApplicationsCount,
} from "../../../../../../logic/api/adoptersApi";
import { getUnreadCount } from "../../../../../../logic/api/notificationsApi";
import { notificationKeys } from "../../../../../../logic/notifications/notificationKeys";

const StatsWidget = () => {
  const adoptedPetsQuery = useQuery({
    queryKey: ["adopter", "adopted-pets"],
    queryFn: getMyAdoptedPets,
  });
  const applicationsCountQuery = useQuery({
    queryKey: ["adopter", "applications-count"],
    queryFn: getMyApplicationsCount,
  });
  // Same key as the navbar bell, so the live stream keeps both in step.
  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
  });

  const petsCount = adoptedPetsQuery.data?.length;
  const applicationsCount = applicationsCountQuery.data;
  const unreadCount = unreadCountQuery.data;

  return (
    // Always 2 columns x 2 rows. sm and up: a fixed 356x356 square — 2 tiles
    // (144px) + gap (20px) + padding (24px each side). A phone's content area
    // is narrower than 356px, so there the card spans the width and the tiles
    // fill it, the gap matching the card's padding.
    <Card className="w-full shrink-0 p-4 sm:h-[356px] sm:w-[356px] sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
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
        <StatTile
          icon={<PiBellBold />}
          value={unreadCount ?? "—"}
          label="Notifications"
          color="green"
        />
      </div>
    </Card>
  );
};

export default StatsWidget;
