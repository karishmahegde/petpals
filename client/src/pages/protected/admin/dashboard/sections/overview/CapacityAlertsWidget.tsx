// CapacityAlertsWidget.tsx
// Shelters at or near capacity, on the admin Overview page — >=90% utilization
// (from GET /analytics/shelters, same source/query key as SheltersWidget and
// the Shelters tab). "Notify Manager" only shows when a manager is actually
// assigned (nothing to notify otherwise, same as the Shelters tab row).
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../../components/ui/Badge";
import {
  getShelterAnalytics,
  type ShelterAnalyticsItem,
} from "../../../../../../logic/api/analyticsApi";

const FULL_THRESHOLD = 100;
const ALMOST_FULL_THRESHOLD = 90;

type AlertLevel = "Full" | "Almost Full";

const ALERT_TONE: Record<AlertLevel, BadgeTone> = {
  Full: "red",
  "Almost Full": "gold",
};

const alertLevel = (shelter: ShelterAnalyticsItem): AlertLevel | null => {
  const utilization = shelter.utilization ?? 0;
  if (utilization >= FULL_THRESHOLD) return "Full";
  if (utilization >= ALMOST_FULL_THRESHOLD) return "Almost Full";
  return null;
};

// No notification system exists yet anywhere in the app (see
// DashboardNavbar's hardcoded hasNotifications=false) — same placeholder
// treatment here, an honest toast instead of a fake "sent" confirmation.
const notifyManager = (shelterName: string, managerName: string | null) =>
  toast(
    `Notifications aren't set up yet — let ${managerName ?? "the manager"} at ${shelterName} know directly for now.`,
  );

const CapacityAlertsWidget = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "shelters-analytics"],
    queryFn: () => getShelterAnalytics(),
  });

  const alerts = (data ?? [])
    .map((shelter) => ({ shelter, level: alertLevel(shelter) }))
    .filter(
      (entry): entry is { shelter: ShelterAnalyticsItem; level: AlertLevel } =>
        entry.level !== null,
    );

  return (
    <OverviewWidgetCard
      icon="🏢"
      title="Capacity Alerts"
      action={{ label: "View All", to: "/admin/shelters" }}
      isLoading={isLoading}
      loadingMessage="Loading capacity alerts…"
      isEmpty={alerts.length === 0}
      emptyMessage="No shelters near capacity."
    >
      <ul className="flex flex-col gap-4">
        {alerts.map(({ shelter, level }) => (
          <li key={shelter.shelterID}>
            <DashboardListRow
              className="bg-teal-light"
              title={shelter.shelterName}
              lines={[{ text: `${shelter.petCount}/${shelter.shelterSize}` }]}
              badge={{ label: level, tone: ALERT_TONE[level] }}
              actions={
                shelter.managerStaffID != null && (
                  <RowActionButton
                    onClick={() =>
                      notifyManager(shelter.shelterName, shelter.managerName)
                    }
                  >
                    Notify Manager
                  </RowActionButton>
                )
              }
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default CapacityAlertsWidget;
