// VisitsWidget.tsx
// "Visits" preview widget on the adopter Overview page — the next few upcoming
// shelter visits. "View All" leads to /adopter/visits for the full history.
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../components/ui/dashboard/DashboardEmptyMessage";
import { getMyVisits } from "../../../../../logic/api/adoptersApi";
import VisitsList from "../shared/VisitsList";

const PREVIEW_LIMIT = 3;

const VisitsWidget = () => {
  const { data: visits, isLoading } = useQuery({
    queryKey: ["adopter", "visits", { upcoming: true }],
    queryFn: () => getMyVisits({ upcoming: true }),
  });

  const upcoming = visits?.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <Card className="flex w-full min-w-0 flex-1 basis-0 flex-col p-5">
      <DashboardWidgetHeader
        icon="🐭"
        title="Visits"
        action={{ label: "View All", to: "/adopter/visits" }}
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}

      {!isLoading && upcoming.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <DashboardEmptyMessage>No upcoming visits</DashboardEmptyMessage>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Explore Pets
          </ButtonElement>
        </div>
      )}

      {!isLoading && upcoming.length > 0 && (
        <VisitsList visits={upcoming} rowClassName="bg-rose-light" />
      )}
    </Card>
  );
};

export default VisitsWidget;
