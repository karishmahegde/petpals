import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import SegmentedControl from "../../../../components/ui/SegmentedControl";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import {
  getVisitsQueue,
  type VisitQueueItem,
} from "../../../../logic/api/visitsApi";
import { formatTime } from "../../../../logic/utils/datetime";
import VisitDetailPanel from "./sections/visits/VisitDetailPanel";

const PAGE_SIZE = 20;

type DateFilter = "upcoming" | "all";

const DATE_FILTER_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Confirmed: "teal",
  Completed: "green",
  Cancelled: "red",
};

// Visits tab — the shelter's visit queue (GET /visits, staff-scoped
// server-side to their own shelter), with a detail slide-over for the full
// picture (adopter, pet, remarks) and Confirm/Complete.
const Visits = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [page, setPage] = useState(1);
  const [selectedVisit, setSelectedVisit] = useState<VisitQueueItem | null>(
    null,
  );

  const changeDateFilter = (value: DateFilter) => {
    setDateFilter(value);
    setPage(1);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "visits-queue", { page, dateFilter, limit: PAGE_SIZE }],
    queryFn: () =>
      getVisitsQueue({
        page,
        limit: PAGE_SIZE,
        upcoming: dateFilter === "upcoming",
      }),
    placeholderData: keepPreviousData,
  });

  const visits = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div>
      <DashboardHeading
        title="Visits"
        emoji="🗓️"
        message="Manage shelter visit requests"
      />

      <Card className="mb-6 p-5">
        <SegmentedControl
          options={DATE_FILTER_OPTIONS}
          value={dateFilter}
          onChange={(v) => changeDateFilter(v as DateFilter)}
          className="max-w-xs"
        />
      </Card>

      {isLoading && (
        <p className="font-body text-sm text-neutral-gray">Loading visits…</p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load visits. Please try again.
        </p>
      )}

      {data && visits.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            {dateFilter === "upcoming"
              ? "No upcoming visits."
              : "No visits yet."}
          </DashboardEmptyMessage>
        </div>
      )}

      {visits.length > 0 && (
        <Card className="p-6">
          <ul className="flex flex-col gap-4">
            {visits.map((visit) => {
              const when = new Date(visit.visitTime);
              const statusLabel = visit.visitStatus ?? "Unconfirmed";

              return (
                <li key={visit.visitID}>
                  <DashboardListRow
                    leading={
                      <div className="w-14 shrink-0 text-center">
                        <p className="font-body text-sm font-bold text-neutral-charcoal">
                          {when.toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        <p className="font-display text-3xl font-light text-neutral-charcoal">
                          {when.getDate()}
                        </p>
                      </div>
                    }
                    title={
                      visit.pet
                        ? `Pet Meet - ${visit.pet.petName}`
                        : "Shelter Visit"
                    }
                    lines={[
                      { text: `${formatTime(when)} · Visitor: ${visit.adopter.adopterName}` },
                      { text: `Staff: ${visit.staff?.staffName ?? "Unassigned"}` },
                    ]}
                    badge={{
                      label: statusLabel,
                      tone: STATUS_TONE[statusLabel] ?? "gold",
                    }}
                    actions={
                      <RowActionButton onClick={() => setSelectedVisit(visit)}>
                        View Details
                      </RowActionButton>
                    }
                  />
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <ButtonElement
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                size="bare"
                variant="outline"
                className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Previous
              </ButtonElement>
              <span className="font-body text-sm text-neutral-gray">
                Page {page} of {totalPages}
              </span>
              <ButtonElement
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                size="bare"
                variant="outline"
                className="rounded-lg border border-neutral-gray px-4 py-2 text-sm font-medium text-neutral-dark hover:bg-neutral-lightgray disabled:opacity-40"
              >
                Next
              </ButtonElement>
            </div>
          )}
        </Card>
      )}

      <VisitDetailPanel
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
      />
    </div>
  );
};

export default Visits;
