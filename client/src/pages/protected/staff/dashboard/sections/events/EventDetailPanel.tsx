// EventDetailPanel.tsx
// Detail slide-over for one upcoming event — opened from an Upcoming Events
// row's "View Details". Same InfoRow layout as the other staff detail panels
// (TaskDetailPanel, AppointmentDetailPanel), plus the assigned volunteers
// (staff-only GET /events/:id/volunteers). Footer stacks Edit Event (hands
// the event up via onEdit; the page opens EventFormPanel) and Cancel Event —
// events have no status, so cancelling deletes the event (and its volunteer
// assignments), behind a ConfirmActionModal.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import Badge from "../../../../../../components/ui/Badge";
import ConfirmActionModal from "../../../../../../components/ui/ConfirmActionModal";
import { getEventById, type EventListItem } from "../../../../../../logic/api/eventsApi";
import {
  deleteEvent,
  getEventVolunteers,
} from "../../../../../../logic/api/staffEventsApi";
import { EVENT_CATEGORY_LABEL } from "../../../../../../logic/eventCategory";
import { formatFullDate, formatTime } from "../../../../../../logic/utils/datetime";

interface EventDetailPanelProps {
  eventID: number | null;
  onClose: () => void;
  onEdit: (event: EventListItem) => void;
}

const label = "font-body text-sm font-semibold text-teal-dark";
const value = "font-body text-sm text-neutral-charcoal";
const sectionTitle = "font-display text-lg text-neutral-dark";
const divider = "my-5 border-t border-neutral-lightgray";

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <>
    <dt className={label}>{k}</dt>
    <dd className={value}>{v}</dd>
  </>
);

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const EventDetailPanel = ({ eventID, onClose, onEdit }: EventDetailPanelProps) => {
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Both keys sit under ["staff", "events"], so EventFormPanel's save
  // invalidation refreshes this panel too.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", "events", "detail", eventID],
    queryFn: () => getEventById(eventID!),
    enabled: eventID !== null,
  });

  const { data: volunteers, isLoading: volunteersLoading } = useQuery({
    queryKey: ["staff", "events", "volunteers", eventID],
    queryFn: () => getEventVolunteers(eventID!),
    enabled: eventID !== null,
  });

  const cancelEvent = useMutation({
    mutationFn: () => deleteEvent(eventID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "events"] });
      toast.success("Event cancelled");
      setConfirmingCancel(false);
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  return (
    <>
      <SlideOver
        open={eventID !== null}
        onClose={onClose}
        title="Event Details"
        footer={
          data ? (
            <div className="flex flex-col gap-3">
              <ButtonElement
                onClick={() => onEdit(data)}
                size="panel"
                className="w-full bg-teal-dark hover:brightness-95"
              >
                Edit Event
              </ButtonElement>
              <ButtonElement
                onClick={() => setConfirmingCancel(true)}
                size="panel"
                className="w-full bg-red hover:brightness-90"
              >
                Cancel Event
              </ButtonElement>
            </div>
          ) : undefined
        }
      >
        {isLoading && (
          <p className="p-8 text-center text-sm text-neutral-gray">Loading event…</p>
        )}
        {isError && (
          <p className="p-8 text-center text-sm text-rose-dark">
            Couldn't load this event. Please try again.
          </p>
        )}

        {data && (
          <div className="p-6">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <InfoRow k="Event" v={data.eventName} />
              <dt className={label}>Category</dt>
              <dd>
                <Badge tone="teal" variant="outline">
                  {EVENT_CATEGORY_LABEL[data.eventCategory]}
                </Badge>
              </dd>
              <InfoRow
                k="Date & time"
                v={`${formatFullDate(new Date(data.eventDate))} · ${formatTime(
                  new Date(data.eventDate),
                )}`}
              />
              <InfoRow k="Shelter" v={data.shelter.shelterName} />
              <InfoRow k="Description" v={data.eventDesc} />
            </dl>

            <div className={divider} />
            <h2 className={sectionTitle}>Assigned Volunteers</h2>
            {volunteersLoading ? (
              <p className="mt-2 font-body text-xs text-neutral-gray">Loading…</p>
            ) : volunteers && volunteers.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {volunteers.map((v) => (
                  <li
                    key={v.volunteerID}
                    className="rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-3 font-body text-sm font-semibold text-neutral-charcoal"
                  >
                    {v.volunteerName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-body text-xs text-neutral-gray">
                No volunteers assigned yet.
              </p>
            )}
          </div>
        )}
      </SlideOver>

      {data && (
        <ConfirmActionModal
          isOpen={confirmingCancel}
          title="Cancel this event?"
          confirmLabel="Cancel Event"
          isPending={cancelEvent.isPending}
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={() => cancelEvent.mutate()}
        >
          This removes "{data.eventName}" and its volunteer assignments. This
          can't be undone.
        </ConfirmActionModal>
      )}
    </>
  );
};

export default EventDetailPanel;
