// ApplicationsWidget.tsx
// "Applications" preview widget on the adopter Overview page — the three most
// recent applications, with the same rows and actions as the full section.
// "View All" leads to /adopter/applications for the rest.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { getMyApplications } from "../../../../../logic/api/adoptersApi";
import ApplicationsList from "../shared/ApplicationsList";

const PREVIEW_LIMIT = 3;

const ApplicationsWidget = () => {
  const { data: applications, isLoading } = useQuery({
    queryKey: ["adopter", "applications", { limit: PREVIEW_LIMIT }],
    queryFn: () => getMyApplications({ limit: PREVIEW_LIMIT }),
  });

  const hasApplications = applications && applications.length > 0;

  return (
    <Card className="flex w-full min-w-0 flex-1 basis-0 flex-col p-5">
      <DashboardWidgetHeader
        icon="📋"
        title="Applications"
        action={{ label: "View All", to: "/adopter/applications" }}
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}

      {!isLoading && !hasApplications && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <p className="font-body text-sm text-neutral-gray">
            You have no active applications
          </p>
          <Link
            to="/adopt"
            className="rounded-xl bg-teal-dark px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:brightness-90"
          >
            Explore Pets
          </Link>
        </div>
      )}

      {!isLoading && hasApplications && (
        <ApplicationsList applications={applications} />
      )}
    </Card>
  );
};

export default ApplicationsWidget;
