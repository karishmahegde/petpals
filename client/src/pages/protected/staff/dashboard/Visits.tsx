import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import {
  getVisitsQueue,
  type VisitQueueItem,
  type VisitStatusFilter,
} from "../../../../logic/api/visitsApi";
import { formatTime } from "../../../../logic/utils/datetime";
import VisitDetailPanel from "./sections/visits/VisitDetailPanel";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, BadgeTone> = {
  Confirmed: "teal",
  Completed: "green",
  Cancelled: "red",
};

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

type StatusFilter = VisitStatusFilter | "all";

// Upcoming never holds Cancelled (and a future visit can't be Completed yet).
const UPCOMING_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Unconfirmed", label: "Unconfirmed" },
  { value: "Confirmed", label: "Confirmed" },
];

const PAST_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  ...UPCOMING_STATUS_OPTIONS,
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

// Status select + Staff/Adopter name search — one per section. Stateless:
// Visits owns each section's filter values.
const VisitFilters = ({
  idPrefix,
  statusOptions,
  status,
  onStatusChange,
  name,
  onNameChange,
}: {
  idPrefix: string;
  statusOptions: { value: StatusFilter; label: string }[];
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  name: string;
  onNameChange: (name: string) => void;
}) => (
  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <SelectField
      label="Status"
      value={status}
      onChange={(v) => onStatusChange(v as StatusFilter)}
      options={statusOptions}
    />
    <div>
      <label className={filterLabelClass} htmlFor={`${idPrefix}-name`}>
        Staff/Adopter Name
      </label>
      <input
        id={`${idPrefix}-name`}
        placeholder="Search by staff or adopter name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className={filterInputClass}
      />
    </div>
  </div>
);

const VisitRow = ({
  visit,
  className,
  onViewDetails,
}: {
  visit: VisitQueueItem;
  className: string;
  onViewDetails: () => void;
}) => {
  const when = new Date(visit.visitTime);
  const statusLabel = visit.visitStatus ?? "Unconfirmed";
  return (
    <DashboardListRow
      className={className}
      leading={
        <div className="w-12 shrink-0 text-center">
          <p className="font-body text-sm font-bold text-neutral-charcoal">
            {when.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="font-display text-3xl font-light text-neutral-charcoal">
            {when.getDate()}
          </p>
        </div>
      }
      title={visit.pet ? `Pet Meet - ${visit.pet.petName}` : "Shelter Visit"}
      lines={[
        {
          text: `${formatTime(when)} | Scheduled for: ${visit.adopter.adopterName}`,
        },
        ...(visit.remarks ? [{ text: visit.remarks }] : []),
      ]}
      badge={{ label: statusLabel, tone: STATUS_TONE[statusLabel] ?? "gold" }}
      actions={<RowActionButton onClick={onViewDetails}>View Details</RowActionButton>}
    />
  );
};

// Visits tab — Upcoming Visits (future, not Cancelled) and Past/Cancelled
// Visits (already happened OR Cancelled), each its own paginated GET
// /visits query scoped server-side to the caller's shelter, with its own
// Status + Staff/Adopter name filters — same two-section split as the
// Appointments tab. A row's "View Details" opens
// VisitDetailPanel (Confirm/Complete).
const Visits = () => {
  const [selectedVisit, setSelectedVisit] = useState<VisitQueueItem | null>(
    null,
  );

  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingStatus, setUpcomingStatus] = useState<StatusFilter>("all");
  const [upcomingName, setUpcomingName] = useState("");
  const upcomingQuery = useQuery({
    queryKey: [
      "staff",
      "visits-queue",
      "upcoming",
      { page: upcomingPage, upcomingStatus, upcomingName },
    ],
    queryFn: () =>
      getVisitsQueue({
        upcoming: true,
        status: upcomingStatus === "all" ? undefined : upcomingStatus,
        name: upcomingName || undefined,
        page: upcomingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const upcomingVisits = upcomingQuery.data?.data ?? [];

  const [pastPage, setPastPage] = useState(1);
  const [pastStatus, setPastStatus] = useState<StatusFilter>("all");
  const [pastName, setPastName] = useState("");
  const pastQuery = useQuery({
    queryKey: ["staff", "visits-queue", "past", { page: pastPage, pastStatus, pastName }],
    queryFn: () =>
      getVisitsQueue({
        past: true,
        status: pastStatus === "all" ? undefined : pastStatus,
        name: pastName || undefined,
        page: pastPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const pastVisits = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Visits"
        emoji="🏬"
        message="Manage shelter visits and meet-and-greets"
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🗓️" title="Upcoming Visits" className="mb-4" />

        <VisitFilters
          idPrefix="upcoming"
          statusOptions={UPCOMING_STATUS_OPTIONS}
          status={upcomingStatus}
          onStatusChange={(v) => {
            setUpcomingStatus(v);
            setUpcomingPage(1);
          }}
          name={upcomingName}
          onNameChange={(v) => {
            setUpcomingName(v);
            setUpcomingPage(1);
          }}
        />

        {upcomingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {upcomingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load upcoming visits. Please try again.
          </p>
        )}
        {upcomingQuery.data && upcomingVisits.length === 0 && (
          <DashboardEmptyMessage>No upcoming visits match your filters.</DashboardEmptyMessage>
        )}

        {upcomingVisits.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcomingVisits.map((visit) => (
              <li key={visit.visitID}>
                <VisitRow
                  visit={visit}
                  className="bg-gold-lightest"
                  onViewDetails={() => setSelectedVisit(visit)}
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={upcomingPage}
          totalPages={upcomingQuery.data?.pagination.totalPages ?? 1}
          onChange={setUpcomingPage}
        />
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="📁" title="Past/Cancelled Visits" className="mb-4" />

        <VisitFilters
          idPrefix="past"
          statusOptions={PAST_STATUS_OPTIONS}
          status={pastStatus}
          onStatusChange={(v) => {
            setPastStatus(v);
            setPastPage(1);
          }}
          name={pastName}
          onNameChange={(v) => {
            setPastName(v);
            setPastPage(1);
          }}
        />

        {pastQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past visits. Please try again.
          </p>
        )}
        {pastQuery.data && pastVisits.length === 0 && (
          <DashboardEmptyMessage>
            No past or cancelled visits match your filters.
          </DashboardEmptyMessage>
        )}

        {pastVisits.length > 0 && (
          <ul className="flex flex-col gap-4">
            {pastVisits.map((visit) => (
              <li key={visit.visitID}>
                <VisitRow
                  visit={visit}
                  className="bg-neutral-lightgray"
                  onViewDetails={() => setSelectedVisit(visit)}
                />
              </li>
            ))}
          </ul>
        )}

        <PaginationControls
          page={pastPage}
          totalPages={pastQuery.data?.pagination.totalPages ?? 1}
          onChange={setPastPage}
        />
      </Card>

      <VisitDetailPanel
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
      />
    </div>
  );
};

export default Visits;
