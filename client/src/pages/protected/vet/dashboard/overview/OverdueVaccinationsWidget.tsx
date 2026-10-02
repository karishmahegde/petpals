// OverdueVaccinationsWidget.tsx
// "Overdue Vaccinations" on the vet Overview — pets at the vet's shelter
// whose latest dose of a vaccine is past due (GET
// /vets/me/vaccinations/overdue), most overdue first. Each opens the pet's
// health passport; "View All" goes to the Vaccinations tab.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewWidgetCard } from "../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../components/ui/dashboard/DashboardList";
import { overdueVaccinationsQuery } from "./overdueVaccinationsQuery";

const PREVIEW_LIMIT = 5;

const OverdueVaccinationsWidget = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(overdueVaccinationsQuery);
  const overdue = (data ?? []).slice(0, PREVIEW_LIMIT);

  return (
    <OverviewWidgetCard
      icon="💉"
      title="Overdue Vaccinations"
      action={{ label: "View All", to: "/vet/vaccinations" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={overdue.length === 0}
      emptyMessage="No overdue vaccinations — everyone's up to date"
    >
      <ul className="flex flex-col gap-4">
        {overdue.map((item) => (
          <li key={`${item.petID}-${item.vaccineID}`}>
            <DashboardListRow
              className="bg-rose-lightest"
              title={item.petName}
              lines={[
                { text: `${item.vaccineName} (Dose ${item.doseNumber})` },
                {
                  text: `Overdue by ${item.daysOverdue} ${item.daysOverdue === 1 ? "day" : "days"}`,
                },
              ]}
              actions={
                <RowActionButton
                  onClick={() =>
                    navigate(`/vet/health-records/${item.petID}/health-passport`)
                  }
                >
                  Health Passport
                </RowActionButton>
              }
            />
          </li>
        ))}
      </ul>
    </OverviewWidgetCard>
  );
};

export default OverdueVaccinationsWidget;
