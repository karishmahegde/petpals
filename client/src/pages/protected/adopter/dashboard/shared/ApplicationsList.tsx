// ApplicationsList.tsx
// The adopter's application rows — used by both the Overview preview widget and
// the full Applications section. This is now just the Applications-specific
// config for the generic DashboardActionList: the row markup + the withdraw
// action. "View Details" routes to the Applications tab with the application id
// in the query string — the tab will eventually read that and open an inline
// detail view there.
import { useNavigate } from "react-router-dom";
import { FaPaw } from "react-icons/fa";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  RowMedallion,
} from "../../../../../components/ui/dashboard/DashboardList";
import type { AdoptionApplicationListItem } from "../../../../../logic/api/adoptersApi";
import { withdrawApplication } from "../../../../../logic/api/adoptionApplicationsApi";
import { formatFullDate } from "../../../../../logic/utils/datetime";
import {
  APPLICATION_STATUS_META,
  canWithdraw,
} from "../../../../../logic/adopter/applicationStatus";

interface ApplicationsListProps {
  applications: AdoptionApplicationListItem[];
  /** Row background — defaults to the DashboardListRow gold tint. */
  rowClassName?: string;
  /**
   * "View Details" handler. When given (the full section), it opens the detail
   * slide-over in place; when omitted (the Overview widget), the row routes to
   * the Applications tab with ?applicationID=.
   */
  onViewDetails?: (applicationID: number) => void;
}

const ApplicationsList = ({
  applications,
  rowClassName,
  onViewDetails,
}: ApplicationsListProps) => {
  const navigate = useNavigate();

  return (
    <DashboardActionList
      items={applications}
      getKey={(application) => application.applicationID}
      renderRow={(application, confirmWithdraw) => {
        const { pet, shelter, applicationStatus, createdAt } = application;
        const status = APPLICATION_STATUS_META[applicationStatus];

        return (
          <DashboardListRow
            className={rowClassName}
            leading={
              <RowMedallion
                src={pet.petPhoto}
                alt={`${pet.petName} photo`}
                fallback={
                  <FaPaw className="h-6 w-6 text-rose-dark" aria-hidden />
                }
              />
            }
            title={`${pet.petName} - ${pet.breed.breedName}`}
            lines={[
              { text: shelter.shelterName },
              {
                text: `Submitted on: ${formatFullDate(new Date(createdAt))}`,
                strong: true,
              },
            ]}
            badge={{ label: status.label, tone: status.tone }}
            actions={
              <>
                <RowActionButton
                  onClick={() =>
                    onViewDetails
                      ? onViewDetails(application.applicationID)
                      : navigate(
                          `/adopter/applications?applicationID=${application.applicationID}`,
                        )
                  }
                >
                  View Details
                </RowActionButton>
                {canWithdraw(applicationStatus) && (
                  <RowActionButton
                    variant="danger"
                    onClick={() => confirmWithdraw(application)}
                  >
                    Withdraw
                  </RowActionButton>
                )}
              </>
            }
          />
        );
      }}
      confirmAction={{
        mutationFn: (application) =>
          withdrawApplication(application.applicationID),
        // Covers the preview widget, the paginated section, and the Overview
        // stat tile's separate count query.
        invalidateKeys: [
          ["adopter", "applications"],
          ["adopter", "applications-count"],
        ],
        successToast: "Application withdrawn",
        errorToast: "Couldn't withdraw the application. Please try again.",
        modalTitle: "Withdraw application?",
        confirmLabel: "Withdraw",
        renderBody: (application) => (
          <>
            This withdraws your application for{" "}
            <strong>{application.pet.petName}</strong> at{" "}
            {application.shelter.shelterName}. The $15 processing fee isn't
            refunded, and you'd need to re-apply if you change your mind.
          </>
        ),
      }}
    />
  );
};

export default ApplicationsList;
