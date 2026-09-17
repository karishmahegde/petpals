// VisitsWidget.tsx
// "Visits" preview widget on the adopter Overview page — the next few upcoming
// shelter visits. "View All" leads to /adopter/visits for the full history.
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { getMyVisits } from "../../../../../../logic/api/adoptersApi";
import VisitsList from "../../shared/VisitsList";

const PREVIEW_LIMIT = 3;

const VisitsWidget = () => {
  const { data: visits, isLoading } = useQuery({
    queryKey: ["adopter", "visits", { upcoming: true }],
    queryFn: () => getMyVisits({ upcoming: true }),
  });

  const upcoming = visits?.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <OverviewWidgetCard
      icon="🐭"
      title="Visits"
      action={{ label: "View All", to: "/adopter/visits" }}
      className="w-full min-w-0 flex-1 basis-0"
      isLoading={isLoading}
      isEmpty={upcoming.length === 0}
      emptyMessage="No upcoming visits"
      emptyAction={
        <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
          Explore Pets
        </ButtonElement>
      }
    >
      <VisitsList visits={upcoming} rowClassName="bg-rose-light" />
    </OverviewWidgetCard>
  );
};

export default VisitsWidget;
