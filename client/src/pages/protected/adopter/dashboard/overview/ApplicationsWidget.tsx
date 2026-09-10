// ApplicationsWidget.tsx
// "Applications" preview widget on the adopter Overview page — the three most
// recent applications, with the same rows and actions as the full section.
// "View All" leads to /adopter/applications for the rest.
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../components/ui/ButtonElement";
import Card from "../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../components/ui/dashboard/DashboardEmptyMessage";
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
          <DashboardEmptyMessage>
            You have no active applications
          </DashboardEmptyMessage>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Explore Pets
          </ButtonElement>
        </div>
      )}

      {!isLoading && hasApplications && (
        <ApplicationsList
          applications={applications}
          rowClassName="bg-teal-light"
        />
      )}
    </Card>
  );
};

export default ApplicationsWidget;
