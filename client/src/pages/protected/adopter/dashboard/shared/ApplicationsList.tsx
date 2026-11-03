// ApplicationsList.tsx
// The adopter's application rows — used by both the Overview preview widget and
// the full Applications section. This is now just the Applications-specific
// config for the generic DashboardActionList: the row markup + the withdraw
// (under consideration) / surrender (approved) action. "View Details" routes to the Applications tab with the application id
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
  RELEASE_ACTION_COPY,
  releaseActionFor,
} from "../../../../../logic/adopter/applicationStatus";
import ReleaseApplicationBody from "./ReleaseApplicationBody";

// Every row with a confirm action has one, so the non-null assertion holds.
const copyFor = (application: AdoptionApplicationListItem) =>
  RELEASE_ACTION_COPY[releaseActionFor(application.applicationStatus)!];

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
      renderRow={(application, confirmRelease) => {
        const { pet, shelter, applicationStatus, createdAt } = application;
        const status = APPLICATION_STATUS_META[applicationStatus];
        const releaseAction = releaseActionFor(applicationStatus);

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
                {releaseAction && (
                  <RowActionButton
                    variant="danger"
                    onClick={() => confirmRelease(application)}
                  >
                    {RELEASE_ACTION_COPY[releaseAction].rowLabel}
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
        // Covers the preview widget, the paginated section, the Overview
        // stat tiles' separate count queries and My Pets (a surrender
        // removes the pet).
        invalidateKeys: [
          ["adopter", "applications"],
          ["adopter", "applications-count"],
          ["adopter", "adopted-pets"],
        ],
        successToast: (application) => copyFor(application).successToast,
        errorToast: (application) => copyFor(application).errorToast,
        modalTitle: (application) => copyFor(application).modalTitle,
        confirmLabel: (application) => copyFor(application).confirmLabel,
        renderBody: (application) => (
          <ReleaseApplicationBody
            action={releaseActionFor(application.applicationStatus)!}
            petName={application.pet.petName}
            shelterName={application.shelter.shelterName}
          />
        ),
      }}
    />
  );
};

export default ApplicationsList;
