import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FaPlus } from "react-icons/fa";
import DashboardHeading from "../../../../components/ui/dashboard/DashboardHeading";
import ButtonElement from "../../../../components/ui/ButtonElement";
import DashboardEmptyMessage from "../../../../components/ui/dashboard/DashboardEmptyMessage";
import Card from "../../../../components/ui/Card";
import type { BadgeTone } from "../../../../components/ui/Badge";
import {
  DashboardActionList,
  DashboardListRow,
  RowActionButton,
} from "../../../../components/ui/dashboard/DashboardList";
import { getMyStaffProfile } from "../../../../logic/api/staffApi";
import { getEvents, type EventListItem } from "../../../../logic/api/eventsApi";
import { deleteEvent } from "../../../../logic/api/staffEventsApi";
import { formatTime, relativeDateBadge } from "../../../../logic/utils/datetime";
import EventFormPanel from "./sections/events/EventFormPanel";

const PAGE_SIZE = 20;

const BADGE_TONE: Record<string, BadgeTone> = {
  Soon: "gold",
  Upcoming: "teal",
  Past: "neutral",
};

// Events tab — the shelter's event calendar (GET /events, filtered to the
// staff member's own shelterID — resolved from GET /staff/me, since GET
// /events itself is the public, network-wide endpoint with no server-side
// staff scoping). Create/Edit share one SlideOver form (EventFormPanel);
// Delete is a per-row action via the generic DashboardActionList, which
// owns the confirm-then-mutate flow (ConfirmActionModal included).
const Events = () => {
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventListItem | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["staff", "me"],
    queryFn: getMyStaffProfile,
  });
  const shelterID = profile?.shelterID;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "events", { shelterID, page }],
    queryFn: () => getEvents({ shelterID: shelterID as number, page, limit: PAGE_SIZE }),
    enabled: shelterID != null,
    placeholderData: keepPreviousData,
  });

  const events = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const loading = isLoading || shelterID == null;

  const openCreate = () => {
    setEditingEvent(null);
    setPanelOpen(true);
  };

  const openEdit = (event: EventListItem) => {
    setEditingEvent(event);
    setPanelOpen(true);
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
          onClick: openCreate,
        }}
      />

      {loading && (
        <p className="font-body text-sm text-neutral-gray">Loading events…</p>
      )}

      {isError && (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load events. Please try again.
        </p>
      )}

      {data && events.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-md">
          <DashboardEmptyMessage>
            No events yet — create the first one to get started.
          </DashboardEmptyMessage>
        </div>
      )}

      {events.length > 0 && (
        <Card className="p-6">
          <DashboardActionList
            items={events}
            getKey={(event) => event.eventID}
            renderRow={(event, confirmDelete) => {
              const when = new Date(event.eventDate);
              const badgeLabel = relativeDateBadge(when);

              return (
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
                  title={event.eventName}
                  lines={[
                    { text: `${formatTime(when)} | ${event.eventLocation}` },
                    { text: event.eventDesc },
                  ]}
                  badge={{ label: badgeLabel, tone: BADGE_TONE[badgeLabel] ?? "teal" }}
                  actions={
                    <>
                      <RowActionButton onClick={() => openEdit(event)}>
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
              );
            }}
            confirmAction={{
              mutationFn: (event) => deleteEvent(event.eventID),
              invalidateKeys: [["staff", "events"]],
              successToast: "Event deleted",
              errorToast: "Couldn't delete the event. Please try again.",
              modalTitle: "Delete this event?",
              confirmLabel: "Delete",
              renderBody: (event) => (
                <>
                  This permanently removes "{event.eventName}". This can't be
                  undone.
                </>
              ),
            }}
          />

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

      <EventFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        event={editingEvent}
      />
    </div>
  );
};

export default Events;
