// VisitsWidget.tsx
// "Visits" preview widget on the adopter Overview page — the next few upcoming
// shelter visits. "View All" leads to /adopter/visits for the full history.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
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
          <p className="font-body text-sm text-neutral-gray">
            No upcoming visits
          </p>
          <Link
            to="/adopt"
            className="rounded-xl bg-teal-dark px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
          >
            Explore Pets
          </Link>
        </div>
      )}

      {!isLoading && upcoming.length > 0 && <VisitsList visits={upcoming} />}
    </Card>
  );
};

export default VisitsWidget;
