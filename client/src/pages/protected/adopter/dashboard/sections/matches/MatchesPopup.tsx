// MatchesPopup.tsx — the chat-style panel the floating AI button
// (MatchesLauncher) opens, bottom-right above it. Quiz not taken → the quiz
// (QuizFlow, compact); once saved → the top matches (MatchesList) under a
// "results of your quiz" intro, with Take the quiz again pinned at the
// bottom. Open/retake state lives in useMatchesPopupStore (the Profile quiz
// card opens it too); MatchesLauncher owns which pet's PetDetailsModal is
// open.
//
// Non-modal: the page behind stays usable. Escape and the X close it, and
// focus moves to its heading when it opens (the launcher returns it on close).
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaTimes } from "react-icons/fa";
import { PiSparkleFill } from "react-icons/pi";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import DashboardEmptyMessage from "../../../../../../components/ui/dashboard/DashboardEmptyMessage";
import QuizFlow from "./QuizFlow";
import MatchesList from "./MatchesList";
import { topMatchesQuery } from "../../shared/matchQuiz";
import useMatchesPopupStore from "../../../../../../logic/store/useMatchesPopupStore";

export const MATCHES_POPUP_ID = "ai-matches-popup";
const HEADING_ID = "ai-matches-popup-heading";

interface MatchesPopupProps {
  onClose: () => void;
  openPetId: number | null;
  onKnowMore: (petID: number) => void;
}

const MatchesPopup = ({
  onClose,
  openPetId,
  onKnowMore,
}: MatchesPopupProps) => {
  const { data, isLoading, isError } = useQuery(topMatchesQuery);
  const isOpen = useMatchesPopupStore((state) => state.isOpen);
  // true while retaking — otherwise the quiz shows only until it's taken.
  const isRetaking = useMatchesPopupStore((state) => state.isRetaking);
  const setRetaking = useMatchesPopupStore((state) => state.setRetaking);

  const quizComplete = data?.quizComplete ?? false;
  const showQuiz = isRetaking || (data !== undefined && !quizComplete);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (isOpen) headingRef.current?.focus();
  }, [isOpen]);

  // Escape closes — but not while a PetDetailsModal opened from here is up;
  // that Escape belongs to the modal.
  useEffect(() => {
    if (!isOpen || openPetId !== null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openPetId, onClose]);

  const renderMatches = () => {
    if (isLoading) {
      return (
        <p className="font-body text-sm text-neutral-gray">
          Finding your best matches…
        </p>
      );
    }
    if (isError || !data) {
      return (
        <p className="font-body text-sm text-rose-dark">
          Couldn't load your matches. Please try again later.
        </p>
      );
    }
    if (data.matches.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <DashboardEmptyMessage>
            No available pets match your profile right now. New pets arrive all
            the time, so check back soon!
          </DashboardEmptyMessage>
          <ButtonElement
            to="/adopt"
            className="bg-teal-dark hover:brightness-95"
          >
            Explore Pets
          </ButtonElement>
        </div>
      );
    }
    return (
      <>
        <div className="mb-4">
          <h3 className="font-display text-lg text-neutral-dark">
            Your Top Matches
          </h3>
          <p className="mt-1 font-body text-sm text-neutral-gray">
            Based on your personality quiz answers, these are the available pets
            that fit your lifestyle best.
          </p>
        </div>
        <MatchesList matches={data.matches} onKnowMore={onKnowMore} />
      </>
    );
  };

  // Under the matches (or the no-matches message), pinned below the
  // scrolling body so it's always in view.
  const showRetakeFooter = !showQuiz && quizComplete && !isLoading;

  return (
    // Height cap: the viewport minus the launcher's space below (bottom-24 =
    // 6rem), the sticky DashboardNavbar above (~6rem, and z-50 so it would
    // cover the title bar and X) and a 1rem gap. dvh, so mobile browser bars
    // count. Anything taller scrolls inside the body.
    <div
      id={MATCHES_POPUP_ID}
      role="dialog"
      aria-labelledby={HEADING_ID}
      className={`fixed bottom-24 right-4 z-30 flex max-h-[calc(100dvh-13rem)] w-[calc(100vw-2rem)] max-w-md flex-col rounded-2xl border border-rose-light bg-white shadow-2xl sm:right-6 ${
        isOpen ? "" : "hidden"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-light px-5 py-4">
        <h2
          id={HEADING_ID}
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-display text-xl text-neutral-dark focus:outline-none"
        >
          <PiSparkleFill className="text-rose-dark" aria-hidden />
          Find Your Perfect Match
        </h2>
        <div className="flex items-center gap-4">
          {isRetaking && quizComplete && (
            <ButtonElement
              onClick={() => setRetaking(false)}
              size="bare"
              variant="outline"
              className="font-body text-sm text-rose-dark hover:underline"
            >
              Back to matches
            </ButtonElement>
          )}
          <ButtonElement
            onClick={onClose}
            aria-label="Close"
            size="bare"
            variant="outline"
            className="text-neutral-gray hover:text-neutral-dark"
          >
            <FaTimes />
          </ButtonElement>
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        {showQuiz ? (
          <QuizFlow onSaved={() => setRetaking(false)} />
        ) : (
          renderMatches()
        )}
      </div>

      {showRetakeFooter && (
        <div className="shrink-0 border-t border-rose-light px-5 py-4 shadow-sm">
          <ButtonElement
            onClick={() => setRetaking(true)}
            size="panel"
            className="w-full bg-teal-dark hover:brightness-95"
          >
            Take the quiz again
          </ButtonElement>
        </div>
      )}
    </div>
  );
};

export default MatchesPopup;
