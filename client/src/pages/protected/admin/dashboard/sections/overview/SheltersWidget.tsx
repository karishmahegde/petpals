// SheltersWidget.tsx
// Simplified shelter preview on the admin Overview page — first 5 shelters
// only (name, address, status), read-only. Full management (create/edit,
// status, manager) lives on the Shelters tab, linked via "View All". Shares
// its query key with Shelters.tsx so the two stay in sync/deduped.
import { useQuery } from "@tanstack/react-query";
import { PiBuildingsBold } from "react-icons/pi";
import Card from "../../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
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
    <Card className="p-4 sm:p-6">
      <DashboardWidgetHeader
        icon="🏢"
        title="Shelters"
        action={{ label: "View All", to: "/admin/shelters" }}
      />

      {isLoading ? (
        <p className="py-8 text-center font-body text-sm text-neutral-gray">
          Loading shelters…
        </p>
      ) : shelters.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-neutral-gray">
          No shelters yet.
        </p>
      ) : (
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
      )}
    </Card>
  );
};

export default SheltersWidget;
