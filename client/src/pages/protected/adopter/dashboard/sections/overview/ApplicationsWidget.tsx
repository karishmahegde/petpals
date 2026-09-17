// ApplicationsWidget.tsx
// "Applications" preview widget on the adopter Overview page — the three most
// recent applications, with the same rows and actions as the full section.
// "View All" leads to /adopter/applications for the rest.
import { useQuery } from "@tanstack/react-query";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import { getMyApplications } from "../../../../../../logic/api/adoptersApi";
import ApplicationsList from "../../shared/ApplicationsList";

const PREVIEW_LIMIT = 3;

const ApplicationsWidget = () => {
  const { data: applications, isLoading } = useQuery({
    queryKey: ["adopter", "applications", { limit: PREVIEW_LIMIT }],
    queryFn: () => getMyApplications({ limit: PREVIEW_LIMIT }),
  });

  const hasApplications = !!applications && applications.length > 0;

  return (
    <OverviewWidgetCard
      icon="📋"
      title="Applications"
      action={{ label: "View All", to: "/adopter/applications" }}
      className="w-full min-w-0 flex-1 basis-0"
      isLoading={isLoading}
      isEmpty={!hasApplications}
      emptyMessage="You have no active applications"
      emptyAction={
        <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
          Explore Pets
        </ButtonElement>
      }
    >
      <ApplicationsList
        applications={applications ?? []}
        rowClassName="bg-teal-light"
      />
    </OverviewWidgetCard>
  );
};

export default ApplicationsWidget;
