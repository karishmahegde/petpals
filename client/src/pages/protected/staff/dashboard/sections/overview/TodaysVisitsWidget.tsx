// TodaysVisitsWidget.tsx
// "Today's Visits" preview widget on the Staff Overview page — every visit
// scheduled for today at the staff member's shelter (GET /visits is already
// scoped server-side; today's date is a client-side filter, since the
// endpoint has no date-range param — see server/.../visits.service.js).
// "View All" leads to /staff/visits (still a placeholder tab — a later
// sprint card builds it out).
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewWidgetCard } from "../../../../../../components/ui/dashboard/DashboardWidgetHeader";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../../../components/ui/dashboard/DashboardList";
import type { BadgeTone } from "../../../../../../components/ui/Badge";
import { getVisitsQueue } from "../../../../../../logic/api/visitsApi";
import { formatTime } from "../../../../../../logic/utils/datetime";

const PREVIEW_LIMIT = 5;
// Large enough to cover a single shelter's full day without paginating —
// this is a preview widget, not the full Visits tab.
const FETCH_LIMIT = 100;

const STATUS_LABEL: Record<string, string> = {
  Confirmed: "Confirmed",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  Confirmed: "teal",
  Completed: "green",
  Cancelled: "red",
};

const isToday = (isoDateTime: string) => {
  const date = new Date(isoDateTime);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const TodaysVisitsWidget = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["staff", "visits-queue", { limit: FETCH_LIMIT }],
    queryFn: () => getVisitsQueue({ limit: FETCH_LIMIT }),
  });

  const visits = (data?.data ?? [])
    .filter((visit) => isToday(visit.visitTime))
    .slice(0, PREVIEW_LIMIT);

  return (
    <OverviewWidgetCard
      icon="🗓️"
      title="Today's Visits"
      action={{ label: "View All", to: "/staff/visits" }}
      className="min-h-[420px]"
      isLoading={isLoading}
      isEmpty={visits.length === 0}
      emptyMessage="No visits scheduled for today"
    >
      <ul className="flex flex-col gap-4">
        {visits.map((visit) => {
          const when = new Date(visit.visitTime);
          const [time, meridiem] = formatTime(when).split(" ");

          return (
            <li key={visit.visitID}>
              <DashboardListRow
                leading={
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-body text-sm font-bold text-neutral-charcoal">
                      {time}
                    </p>
                    <p className="font-body text-xs text-neutral-gray">
                      {meridiem}
                    </p>
                  </div>
                }
                title={
                  visit.pet ? `Pet Meet - ${visit.pet.petName}` : "Shelter Visit"
                }
                lines={[
                  {
                    text: `Visitor: ${visit.adopter.adopterName} | Staff: ${
                      visit.staff?.staffName ?? "Unassigned"
                    }`,
                  },
                ]}
                badge={{
                  label: visit.visitStatus
                    ? STATUS_LABEL[visit.visitStatus]
                    : "Unconfirmed",
                  tone: visit.visitStatus
                    ? STATUS_TONE[visit.visitStatus]
                    : "gold",
                }}
                actions={
                  <RowActionButton onClick={() => navigate("/staff/visits")}>
                    View Details
                  </RowActionButton>
                }
              />
            </li>
          );
        })}
      </ul>
    </OverviewWidgetCard>
  );
};

export default TodaysVisitsWidget;
