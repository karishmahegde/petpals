import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PiCalendarBlank, PiCheckSquare, PiFunnel } from "react-icons/pi";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import {
  DashboardListRow,
  type RowBadge,
} from "../../../../components/ui/dashboard/DashboardList";
import Card from "../../../../components/ui/Card";
import SelectField from "../../../../components/ui/SelectField";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  getMyVolunteerEvents,
  type MyVolunteerEvent,
} from "../../../../logic/api/volunteersApi";
import { EVENT_CATEGORY_LABEL } from "../../../../logic/eventCategory";
import {
  endOfDayISO,
  formatTime,
  relativeDateBadge,
} from "../../../../logic/utils/datetime";
import DateBlock from "./shared/DateBlock";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "assigned";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "assigned", label: "Assigned to Me" },
];

// Upcoming-only date ranges, worked out in the volunteer's own timezone and
// sent as dateTo (the upcoming half already starts at "now") — same options
// as the vet Appointments tab.
type DateRange = "all" | "today" | "week" | "month";

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

const DAYS_AHEAD: Record<Exclude<DateRange, "all">, number> = {
  today: 0,
  week: 7,
  month: 30,
};

const DATE_BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
};

const EventRow = ({
  event,
  className,
  badge,
}: {
  event: MyVolunteerEvent;
  className: string;
  badge?: RowBadge;
}) => (
  <DashboardListRow
    className={className}
    leading={<DateBlock iso={event.eventDate} />}
    title={event.eventName}
    lines={[
      { text: event.eventDesc },
      {
        text: `${formatTime(new Date(event.eventDate))} | ${event.shelter.shelterName} · ${
          EVENT_CATEGORY_LABEL[event.eventCategory]
        }`,
      },
    ]}
    badge={badge}
  />
);

// Events tab (/volunteer/events) — same two-card layout as the vet
// Appointments tab. Upcoming Events: every upcoming event at the
// volunteer's shelter (GET /volunteers/me/events?upcoming=true), soonest
// first, with a Filters box (Status: all / assigned to me; Event Date
// range). Past Events: the ones staff had them on, most recent first.
// Read-only: volunteers don't sign themselves up — staff assign them when
// creating or editing an event — so an assigned event carries an
// "Assigned to you" badge instead of a Sign up button.
const Events = () => {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [upcomingPage, setUpcomingPage] = useState(1);

  const upcomingQuery = useQuery({
    queryKey: ["volunteer", "events", "upcoming", { status, dateRange, page: upcomingPage }],
    queryFn: () =>
      getMyVolunteerEvents({
        upcoming: true,
        assigned: status === "assigned" ? true : undefined,
        dateTo: dateRange === "all" ? undefined : endOfDayISO(DAYS_AHEAD[dateRange]),
        page: upcomingPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const [pastPage, setPastPage] = useState(1);
  const pastQuery = useQuery({
    queryKey: ["volunteer", "events", "past", { page: pastPage }],
    queryFn: () =>
      getMyVolunteerEvents({
        upcoming: false,
        assigned: true,
        page: pastPage,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const upcoming = upcomingQuery.data?.data ?? [];
  const past = pastQuery.data?.data ?? [];

  return (
    <div>
      <DashboardHeading
        title="Events"
        emoji="🎉"
        message="Shelter events, and the ones you're helping with"
        showDate
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🗓️" title="Upcoming Events" className="mb-4" />

        <div className="mb-5 rounded-2xl border border-neutral-lightgray p-4">
          <p className="mb-3 flex items-center gap-1.5 font-body text-base font-semibold text-neutral-dark">
            <PiFunnel aria-hidden /> Filters
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Status"
              icon={<PiCheckSquare className="text-neutral-gray" />}
              value={status}
              onChange={(v) => {
                setStatus(v as StatusFilter);
                setUpcomingPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <SelectField
              label="Event Date"
              icon={<PiCalendarBlank className="text-neutral-gray" />}
              value={dateRange}
              onChange={(v) => {
                setDateRange(v as DateRange);
                setUpcomingPage(1);
              }}
              options={DATE_OPTIONS}
            />
          </div>
        </div>

        {upcomingQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {upcomingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load upcoming events. Please try again.
          </p>
        )}
        {upcomingQuery.data && upcoming.length === 0 && (
          <DashboardEmptyMessage>
            {status === "all" && dateRange === "all"
              ? "No upcoming events at your shelter."
              : "No upcoming events match your filters."}
          </DashboardEmptyMessage>
        )}

        {upcoming.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcoming.map((event) => {
              const dateBadge = relativeDateBadge(new Date(event.eventDate));
              return (
                <li key={event.eventID}>
                  <EventRow
                    event={event}
                    className="bg-gold-lightest"
                    badge={
                      event.assigned
                        ? { label: "Assigned to you", tone: "green" }
                        : { label: dateBadge, tone: DATE_BADGE_TONE[dateBadge] ?? "teal" }
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        <PaginationControls
          page={upcomingPage}
          totalPages={upcomingQuery.data?.pagination.totalPages ?? 1}
          onChange={setUpcomingPage}
        />
      </Card>

      <Card className="p-6">
        <DashboardWidgetHeader icon="📁" title="Past Events" className="mb-4" />

        {pastQuery.isLoading && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past events. Please try again.
          </p>
        )}
        {pastQuery.data && past.length === 0 && (
          <DashboardEmptyMessage>
            No past events yet — ones you help at will show here.
          </DashboardEmptyMessage>
        )}

        {past.length > 0 && (
          <ul className="flex flex-col gap-4">
            {past.map((event) => (
              <li key={event.eventID}>
                <EventRow
                  event={event}
                  className="bg-neutral-lightgray"
                  badge={{ label: "Completed", tone: "gray" }}
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
    </div>
  );
};

export default Events;
