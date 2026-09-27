// EventImage.tsx
// An event's cover image at 16:9 — the static image for its category (see
// logic/eventCategory.ts), or a calendar placeholder if that category has no
// image yet. Shared by EventCard and EventDetailsModal.
import { FaCalendarAlt } from "react-icons/fa";
import type { EventCategory } from "../../../logic/api/eventsApi";
import { EVENT_CATEGORY_IMAGE } from "../../../logic/eventCategory";

const EventImage = ({ category }: { category: EventCategory }) => {
  const src = EVENT_CATEGORY_IMAGE[category];

  return (
    <div className="aspect-video w-full">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-offwhite">
          <FaCalendarAlt className="h-12 w-12 text-rose-md" aria-hidden />
        </div>
      )}
    </div>
  );
};

export default EventImage;
