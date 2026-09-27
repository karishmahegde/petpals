// SheltersWidget.tsx
// Simplified shelter preview on the admin Overview page — first 5 shelters
// only (name, address, status), read-only. Full management (create/edit,
// status, manager) lives on the Shelters tab, linked via "View All". Shares
// its query key with Shelters.tsx so the two stay in sync/deduped.
import { useQuery } from "@tanstack/react-query";
import { PiBuildingsBold } from "react-icons/pi";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { DashboardListRow } from "../../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../../components/ui/Badge";
import { getShelterAnalytics } from "../../../../../../logic/api/analyticsApi";
import type { ShelterStatus } from "../../../../../../logic/api/sheltersApi";

const STATUS_TONE: Record<ShelterStatus, BadgeTone> = {
  Open: "green",
  Full: "gold",
  Closed: "red",
};

const PREVIEW_COUNT = 5;

const SheltersWidget = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
  });

  const shelters = data?.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <OverviewWidgetCard
      icon="🏢"
      title="Shelters"
      action={{ label: "View All", to: "/admin/shelters" }}
      isLoading={isLoading}
      loadingMessage="Loading shelters…"
      isEmpty={shelters.length === 0}
      emptyMessage="No shelters yet."
    >
      <ul className="flex flex-col gap-4">
        {shelters.map((shelter) => (
          <li key={shelter.shelterID}>
            <DashboardListRow
              className="bg-teal-light"
              leading={
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl text-teal-dark">
                  <PiBuildingsBold />
                </div>
              }
              title={shelter.shelterName}
              lines={[{ text: shelter.shelterAddress }]}
              badge={{
                label: shelter.shelterStatus,
                tone: STATUS_TONE[shelter.shelterStatus],
              }}
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default SheltersWidget;
