// EventFormPanel.tsx
// Create/Edit event form — one panel, two modes, mirroring the Pets tab's
// PetFormPanel (SlideOver, full-form-resent-on-save, no diffing). Unlike
// PetFormPanel, edit mode doesn't re-fetch by ID — there's no staff-specific
// single-event endpoint need here, since the Events tab's list already has
// the full row (eventName/eventDesc/eventDate) needed to pre-fill the form,
// so the already-loaded row is passed down directly instead of duplicating
// the fetch (same reasoning as the Visits tab's VisitDetailPanel).
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import SlideOver from "../../../../../../components/ui/SlideOver";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import { createEvent, updateEvent } from "../../../../../../logic/api/staffEventsApi";
import type { EventCategory, EventListItem } from "../../../../../../logic/api/eventsApi";
import { EVENT_CATEGORY_LABEL } from "../../../../../../logic/eventCategory";

interface EventFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Present -> edit mode, pre-filled from this row. Absent/null -> create mode. */
  event?: EventListItem | null;
}

interface EventFormState {
  eventName: string;
  eventDesc: string;
  eventDate: string; // <input type="datetime-local"> value
  eventCategory: EventCategory | "";
}

const EMPTY_FORM: EventFormState = {
  eventName: "",
  eventDesc: "",
  eventDate: "",
  eventCategory: "",
};

const MAX_NAME_LEN = 45; // schema.prisma: eventName is VarChar(45)
const MAX_DESC_LEN = 300; // schema.prisma: eventDesc is VarChar(300)

const labelClass =
  "mb-1.5 block font-body text-sm font-semibold text-neutral-charcoal";
const fieldClass =
  "w-full rounded-md border border-neutral-lightgray bg-white px-3 py-2.5 font-body text-sm text-neutral-charcoal focus:outline-none focus:ring-1 focus:ring-teal-dark";

// <input type="datetime-local"> only accepts/returns "YYYY-MM-DDTHH:mm" in
// LOCAL time, no timezone — these two helpers are inverses of each other.
const pad = (n: number) => String(n).padStart(2, "0");

const toDatetimeLocalValue = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "Now", ceil'd to the next 15-minute mark — used as `min` in create mode so
// the picker itself blocks past dates/times. (The server independently
// re-validates eventDate is in the future at submit time on create, so this
// is UX guidance, not the source of truth.)
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const minDateTimeLocal = () =>
  toDatetimeLocalValue(
    new Date(Math.ceil(Date.now() / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS).toISOString(),
  );

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

const EventFormPanel = ({ open, onClose, event }: EventFormPanelProps) => {
  const queryClient = useQueryClient();
  const isEdit = event != null;

  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);

  // Re-seed on every open: create mode -> blank form; edit mode -> pre-fill
  // from the row already loaded by the Events tab's list.
  useEffect(() => {
    if (!open) return;
    if (!event) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      eventName: event.eventName,
      eventDesc: event.eventDesc,
      eventDate: toDatetimeLocalValue(event.eventDate),
      eventCategory: event.eventCategory,
    });
  }, [open, event]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        eventName: form.eventName.trim(),
        eventDesc: form.eventDesc.trim(),
        eventDate: new Date(form.eventDate).toISOString(),
        eventCategory: form.eventCategory as EventCategory,
      };
      return isEdit ? updateEvent(event!.eventID, payload) : createEvent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "events"] });
      toast.success(isEdit ? "Event updated" : "Event created");
      onClose();
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const canSubmit =
    form.eventName.trim() !== "" &&
    form.eventDesc.trim() !== "" &&
    form.eventDate !== "" &&
    form.eventCategory !== "" &&
    !saveMutation.isPending;

  return (
    <SlideOver open={open} onClose={onClose} title={isEdit ? "Edit Event" : "Create Event"}>
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) saveMutation.mutate();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="event-name">
            Event name
          </label>
          <input
            id="event-name"
            required
            maxLength={MAX_NAME_LEN}
            value={form.eventName}
            onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="event-category">
            Category
          </label>
          <select
            id="event-category"
            required
            value={form.eventCategory}
            onChange={(e) =>
              setForm((f) => ({ ...f, eventCategory: e.target.value as EventCategory }))
            }
            className={fieldClass}
          >
            <option value="">- Select -</option>
            {Object.entries(EVENT_CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="event-date">
            Date &amp; time
          </label>
          <input
            id="event-date"
            type="datetime-local"
            required
            min={isEdit ? undefined : minDateTimeLocal()}
            value={form.eventDate}
            onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="event-desc">
            Description
          </label>
          <textarea
            id="event-desc"
            required
            rows={4}
            maxLength={MAX_DESC_LEN}
            value={form.eventDesc}
            onChange={(e) => setForm((f) => ({ ...f, eventDesc: e.target.value }))}
            className={fieldClass}
          />
        </div>

        <ButtonElement
          type="submit"
          disabled={!canSubmit}
          size="panel"
          className="mt-2 bg-green hover:brightness-95 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save"
              : "Create Event"}
        </ButtonElement>
      </form>
    </SlideOver>
  );
};

export default EventFormPanel;
