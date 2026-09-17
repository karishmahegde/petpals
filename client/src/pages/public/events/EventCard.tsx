// EventCard.tsx
// One grid tile on the public Events page — page-specific (only used there),
// same placement convention as PetFilterBar living beside PetCatalog.tsx.
// No photo exists for events, so the tile leads with a date block instead
// of an image, mirroring the date-block leading visual already used across
// the Staff dashboard's Visits/Events lists.
import type { EventListItem } from "../../../logic/api/eventsApi";
import { formatTime } from "../../../logic/utils/datetime";

interface EventCardProps {
  event: EventListItem;
  openId: number | null;
  onKnowMore: (eventID: number) => void;
}

const EventCard = ({ event, openId, onKnowMore }: EventCardProps) => {
  const when = new Date(event.eventDate);
  const isDeepLinked = openId === event.eventID;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-white p-5 font-body shadow-md ${
        isDeepLinked ? "ring-4 ring-gold-md ring-offset-2" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 rounded-xl bg-gold-lightest py-2 text-center">
          <p className="text-xs font-bold uppercase text-rose-dark">
            {when.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="text-2xl font-bold text-neutral-charcoal">
            {when.getDate()}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-neutral-charcoal">
            {event.eventName}
          </p>
          <p className="text-xs font-light text-teal-dark">
            {formatTime(when)} · {event.eventLocation}
          </p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 flex-1 text-sm font-light text-neutral-gray">
        {event.eventDesc}
      </p>

      <button
        type="button"
        onClick={() => onKnowMore(event.eventID)}
        className="mt-4 rounded-xl bg-black px-2 py-3 text-xs text-white"
      >
        Know More
      </button>
    </div>
  );
};

export default EventCard;
