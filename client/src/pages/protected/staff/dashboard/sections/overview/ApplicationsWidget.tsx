// ApplicationsWidget.tsx
// "Applications" preview widget on the Staff Overview page — the shelter's
// most recent pending applications awaiting review. "View All" leads to
// /staff/applications; each row deep-links there with the application id for
// that tab to read once it's built (a later Sprint 5.1 card).
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaPaw } from "react-icons/fa";
import Card from "../../../../../../components/ui/Card";
import DashboardWidgetHeader from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../../../components/ui/dashboard/DashboardEmptyMessage";
import {
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../../../components/ui/dashboard/DashboardList";
import { getApplicationsQueue } from "../../../../../../logic/api/adoptionApplicationsApi";

const PREVIEW_LIMIT = 3;

const ApplicationsWidget = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: [
      "staff",
      "applications-queue",
      { status: "Pending", limit: PREVIEW_LIMIT },
    ],
    queryFn: () =>
      getApplicationsQueue({ status: "Pending", limit: PREVIEW_LIMIT }),
  });

  const applications = data?.data ?? [];

  return (
    <Card className="p-5">
      <DashboardWidgetHeader
        icon="📋"
        title="Applications"
        action={{ label: "View All", to: "/staff/applications" }}
      />

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading…</p>
      )}

      {!isLoading && applications.length === 0 && (
        <DashboardEmptyMessage>No pending applications</DashboardEmptyMessage>
      )}

      {!isLoading && applications.length > 0 && (
        <ul className="flex flex-col gap-4">
          {applications.map((application) => (
            <li key={application.applicationID}>
              <DashboardListRow
                className="bg-rose-light"
                leading={
                  <RowMedallion
                    src={application.pet.petPhoto}
                    alt={`${application.pet.petName} photo`}
                    fallback={
                      <FaPaw className="h-6 w-6 text-rose-dark" aria-hidden />
                    }
                  />
                }
                title={application.pet.petName}
                lines={[
                  {
                    text: `Submitted by: ${application.adopter.adopterName}`,
                  },
                ]}
                actions={
                  <RowActionButton
                    onClick={() =>
                      navigate(
                        `/staff/applications?applicationID=${application.applicationID}`,
                      )
                    }
                  >
                    View Details
                  </RowActionButton>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default ApplicationsWidget;
