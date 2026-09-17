// Events.tsx
// Public event listing — no auth. Card-grid + pagination pattern matches
// the /adopt pet catalog (PetCatalog.tsx): loading skeleton, empty state,
// Previous/Next pager, and a page-owned `openId` shared across every card
// so only one detail modal needs to be rendered page-wide. Wrapped in
// SectionContainer/SectionHeadingCenter (the marketing-page chrome
// PetCatalog.tsx itself doesn't use, but this page was asked to).
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axios from "axios";
import SectionContainer from "../../../components/ui/marketing/SectionContainer";
import SectionHeadingCenter from "../../../components/ui/marketing/SectionHeadingCenter";
import { getEvents } from "../../../logic/api/eventsApi";
import EventCard from "./EventCard";
import EventDetailsModal from "./EventDetailsModal";

const LIMIT = 12;

const Events = () => {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const {
    data: eventsResult,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["events", page],
    queryFn: () => getEvents({ page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });

  const events = eventsResult?.data ?? [];
  const pagination = eventsResult?.pagination;

  const errorMessage = axios.isAxiosError(error) && error.response?.data?.message
    ? error.response.data.message
    : "Failed to load events.";

  return (
    <SectionContainer className="bg-neutral-offwhite">
      <SectionHeadingCenter>Shelter Events 🎉</SectionHeadingCenter>
      <p className="mx-auto -mt-6 mb-8 max-w-xl text-center font-light text-neutral-charcoal">
        Adoption days, fundraisers, and meet-and-greets happening across our
        shelter network.
      </p>

      <div className="mx-auto max-w-6xl">
        {isError && (
          <div className="mx-6 my-6 rounded-md bg-rose-light p-4 text-rose-dark">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-neutral-lightgray"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-12 text-center text-neutral-gray">
            No events scheduled right now — check back soon.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.eventID}
                  event={event}
                  openId={openId}
                  onKnowMore={(eventID) => setOpenId(eventID)}
                />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-charcoal">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md bg-teal-dark px-4 py-2 text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <EventDetailsModal eventID={openId} onClose={() => setOpenId(null)} />
    </SectionContainer>
  );
};

export default Events;
