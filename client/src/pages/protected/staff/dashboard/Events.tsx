import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import Badge, { type BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
  type ConfirmActionConfig,
} from "../../../../components/ui/dashboard/DashboardList";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import { getEvents, type EventListItem } from "../../../../logic/api/eventsApi";
import { deleteEvent } from "../../../../logic/api/staffEventsApi";
import { formatTime, relativeDateBadge } from "../../../../logic/utils/datetime";
import { EVENT_CATEGORY_LABEL } from "../../../../logic/eventCategory";
import EventFormPanel from "./sections/events/EventFormPanel";
import EventDetailPanel from "./sections/events/EventDetailPanel";
import PaginationControls from "../../../../components/ui/dashboard/PaginationControls";
import DashboardWidgetHeader from "../../../../components/ui/dashboard/DashboardWidgetHeader";

const PAGE_SIZE = 20;

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
  Past: "neutral",
};

// Matches SelectField's own label + trigger sizing, same as Transfers.tsx.
const filterInputClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";
const filterLabelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";

// Past Events' confirm-then-delete (Upcoming cancels from EventDetailPanel).
const DELETE_ACTION: ConfirmActionConfig<EventListItem> = {
  mutationFn: (event) => deleteEvent(event.eventID),
  invalidateKeys: [["staff", "events"]],
  successToast: "Event deleted",
  errorToast: "Couldn't delete the event. Please try again.",
  modalTitle: "Delete this event?",
  confirmLabel: "Delete",
  renderBody: (event) => (
    <>This permanently removes "{event.eventName}". This can't be undone.</>
  ),
};

const EventNameFilter = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="mb-4 sm:max-w-sm">
    <label className={filterLabelClass} htmlFor={id}>
      Event Name
    </label>
    <input
      id={id}
      placeholder="Search by event name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={filterInputClass}
    />
  </div>
);

const EventRow = ({
  event,
  className,
  actions,
}: {
  event: EventListItem;
  className: string;
  actions: React.ReactNode;
}) => {
  const when = new Date(event.eventDate);
  const badgeLabel = relativeDateBadge(when);

  return (
    <DashboardListRow
      className={className}
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
        <>
          {event.eventName}{" "}
          <Badge tone="teal" variant="outline" className="ml-1">
            {EVENT_CATEGORY_LABEL[event.eventCategory]}
          </Badge>
        </>
      }
      lines={[
        { text: `${formatTime(when)} | ${event.shelter.shelterName}` },
        { text: event.eventDesc },
      ]}
      badge={{ label: badgeLabel, tone: BADGE_TONE[badgeLabel] ?? "teal" }}
      actions={actions}
    />
  );
};

// fromDetail: opened via EventDetailPanel's Edit Event — closing the form
// returns to that event's details (same flow as Appointments.tsx).
type FormState =
  | { mode: "create" }
  | { mode: "edit"; event: EventListItem; fromDetail: boolean };

// Events tab — the shelter's event calendar, split into Upcoming Events (not
// started yet, soonest first) and Past Events (already started, most recent
// first), each its own paginated GET /events query with an event-name
// search. Upcoming rows open EventDetailPanel (assigned volunteers, Edit
// Event, Cancel Event); Past rows keep inline Edit/Delete. Filtered to the staff member's own shelterID, resolved from GET
// /staff/me, since GET /events itself is the public, network-wide endpoint
// with no server-side staff scoping. Create/Edit share one SlideOver form
// (EventFormPanel); Delete is a per-row action via the generic
// DashboardActionList, which owns the confirm-then-mutate flow.
const Events = () => {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [detailID, setDetailID] = useState<number | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const shelterID = profile?.shelterID;

  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingName, setUpcomingName] = useState("");
  const upcomingQuery = useQuery({
    queryKey: [
      "staff",
      "events",
      "upcoming",
      { shelterID, page: upcomingPage, upcomingName },
    ],
    queryFn: () =>
      getEvents({
        shelterID: shelterID as number,
        upcoming: true,
        name: upcomingName.trim() || undefined,
        page: upcomingPage,
        limit: PAGE_SIZE,
      }),
    enabled: shelterID != null,
    placeholderData: keepPreviousData,
  });
  const upcomingEvents = upcomingQuery.data?.data ?? [];

  const [pastPage, setPastPage] = useState(1);
  const [pastName, setPastName] = useState("");
  const pastQuery = useQuery({
    queryKey: ["staff", "events", "past", { shelterID, page: pastPage, pastName }],
    queryFn: () =>
      getEvents({
        shelterID: shelterID as number,
        past: true,
        name: pastName.trim() || undefined,
        page: pastPage,
        limit: PAGE_SIZE,
      }),
    enabled: shelterID != null,
    placeholderData: keepPreviousData,
  });
  const pastEvents = pastQuery.data?.data ?? [];

  const closeForm = () => {
    if (formState?.mode === "edit" && formState.fromDetail) {
      setDetailID(formState.event.eventID);
    }
    setFormState(null);
  };

  return (
    <div>
      <DashboardHeading
        title="Events"
        emoji="🎉"
        message="Manage your shelter's events"
        action={{
          label: "Create Event",
          icon: <FaPlus aria-hidden />,
          onClick: () => setFormState({ mode: "create" }),
        }}
      />

      <Card className="mb-6 p-6">
        <DashboardWidgetHeader icon="🗓️" title="Upcoming Events" className="mb-4" />

        <EventNameFilter
          id="upcoming-event-name"
          value={upcomingName}
          onChange={(v) => {
            setUpcomingName(v);
            setUpcomingPage(1);
          }}
        />

        {(upcomingQuery.isLoading || shelterID == null) && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {upcomingQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load upcoming events. Please try again.
          </p>
        )}
        {upcomingQuery.data && upcomingEvents.length === 0 && (
          <DashboardEmptyMessage>
            {upcomingName.trim()
              ? "No upcoming events match your search."
              : "No upcoming events — create one to get started."}
          </DashboardEmptyMessage>
        )}

        {upcomingEvents.length > 0 && (
          <ul className="flex flex-col gap-4">
            {upcomingEvents.map((event) => (
              <li key={event.eventID}>
                <EventRow
                  event={event}
                  className="bg-gold-lightest"
                  actions={
                    <RowActionButton onClick={() => setDetailID(event.eventID)}>
                      View Details
                    </RowActionButton>
                  }
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
        <DashboardWidgetHeader icon="📁" title="Past Events" className="mb-4" />

        <EventNameFilter
          id="past-event-name"
          value={pastName}
          onChange={(v) => {
            setPastName(v);
            setPastPage(1);
          }}
        />

        {(pastQuery.isLoading || shelterID == null) && (
          <p className="font-body text-sm text-neutral-gray">Loading…</p>
        )}
        {pastQuery.isError && (
          <p className="font-body text-sm text-rose-dark">
            Couldn't load past events. Please try again.
          </p>
        )}
        {pastQuery.data && pastEvents.length === 0 && (
          <DashboardEmptyMessage>
            {pastName.trim() ? "No past events match your search." : "No past events yet."}
          </DashboardEmptyMessage>
        )}

        {pastEvents.length > 0 && (
          <DashboardActionList
            items={pastEvents}
            getKey={(event) => event.eventID}
            renderRow={(event, confirmDelete) => (
              <EventRow
                event={event}
                className="bg-neutral-lightgray"
                actions={
                  <>
                    <RowActionButton
                      onClick={() =>
                        setFormState({ mode: "edit", event, fromDetail: false })
                      }
                    >
                      Edit
                    </RowActionButton>
                    <RowActionButton
                      variant="danger"
                      onClick={() => confirmDelete(event)}
                    >
                      Delete
                    </RowActionButton>
                  </>
                }
              />
            )}
            confirmAction={DELETE_ACTION}
          />
        )}

        <PaginationControls
          page={pastPage}
          totalPages={pastQuery.data?.pagination.totalPages ?? 1}
          onChange={setPastPage}
        />
      </Card>

      <EventFormPanel
        open={formState !== null}
        onClose={closeForm}
        event={formState?.mode === "edit" ? formState.event : null}
      />

      <EventDetailPanel
        eventID={detailID}
        onClose={() => setDetailID(null)}
        onEdit={(event) => {
          setDetailID(null);
          setFormState({ mode: "edit", event, fromDetail: true });
        }}
      />
    </div>
  );
};

export default Events;
