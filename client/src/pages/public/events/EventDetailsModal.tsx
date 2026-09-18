// EventDetailsModal.tsx
// Detail view for one event, opened from an EventCard's "Know More" —
// mirrors PetDetailsModal's chrome (backdrop, mobile slide-up sheet,
// sticky close button) exactly, minus the photo (events have none) and any
// auth-gated actions (no auth on this page at all).
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import { getEventById } from "../../../logic/api/eventsApi";
import ButtonElement from "../../../components/ui/ButtonElement";
import { formatFullDate, formatTime } from "../../../logic/utils/datetime";

interface EventDetailsModalProps {
  eventID: number | null;
  onClose: () => void;
}

const boxStyle =
  "rounded-lg border border-neutral-lightgray bg-neutral-offwhite p-4";
const boxHeadingStyle =
  "mb-2 text-sm font-bold uppercase tracking-wide text-neutral-charcoal";

const EventDetailsModal = ({ eventID, onClose }: EventDetailsModalProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["event", eventID],
    queryFn: () => getEventById(eventID!),
    enabled: eventID !== null,
  });

  // Same mobile slide-up entrance as PetDetailsModal — kept mounted between
  // opens, so `entered` has to be reset and re-flipped on every new open
  // rather than relying on a mount-time transition.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (eventID === null) return;
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [eventID]);

  if (eventID === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white font-body transition-transform duration-300 ease-out sm:max-w-lg sm:translate-y-0 sm:rounded-2xl sm:transition-none ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-3 z-20 flex h-0 justify-end pr-3">
          <ButtonElement
            onClick={onClose}
            aria-label="Close"
            size="bare"
            variant="outline"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-dark hover:bg-white"
          >
            <FaTimes />
          </ButtonElement>
        </div>

        <div className="flex flex-col gap-4 p-6 pt-10">
          {isLoading && (
            <p className="p-8 text-center text-sm text-neutral-gray">
              Loading event details...
            </p>
          )}
          {isError && (
            <p className="p-8 text-center text-sm text-rose-dark">
              Failed to load event details.
            </p>
          )}

          {data && (
            <>
              <div>
                <h2 className="text-xl font-bold text-neutral-charcoal">
                  {data.eventName}
                </h2>
                <p className="text-sm text-teal-dark">{data.eventLocation}</p>
              </div>

              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>When</h3>
                <p className="text-sm font-semibold text-neutral-charcoal">
                  {formatFullDate(new Date(data.eventDate))}
                </p>
                <p className="text-sm text-neutral-charcoal">
                  {formatTime(new Date(data.eventDate))}
                </p>
              </div>

              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>About</h3>
                <p className="text-sm font-light italic text-neutral-charcoal">
                  {data.eventDesc}
                </p>
              </div>

              <div className={boxStyle}>
                <h3 className={boxHeadingStyle}>Shelter</h3>
                <p className="text-sm font-semibold text-neutral-charcoal">
                  {data.shelter.shelterName}
                </p>
                <p className="text-xs text-neutral-gray">
                  {data.shelter.shelterAddress}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;
