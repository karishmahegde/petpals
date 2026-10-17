// MatchesLauncher.tsx
// The floating AI button, bottom-right on every adopter dashboard page — the
// way into the compatibility matcher. Toggles MatchesPopup (quiz first, then
// the matches) through useMatchesPopupStore — the Profile quiz card opens it
// the same way — and owns which pet's PetDetailsModal is open from it. The
// popup mounts on first open, so the matches query (which can run the AI)
// never fires for an adopter who doesn't open it; after that it's only hidden
// on close, so a half-done quiz survives closing it.
// z-30 keeps both under the mobile sidebar overlay (z-40) and modals (z-50).
//
// Adopters only. It's mounted in the adopter DashboardRoutes, which RoleRoute
// already limits to Adopters; the role check here keeps it that way if it's
// ever mounted anywhere else, since everything behind it is adopter-only.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PiSparkleFill } from "react-icons/pi";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import PetDetailsModal from "../../../../../../components/ui/pets/PetDetailsModal";
import useAuthStore from "../../../../../../logic/store/useAuthStore";
import useMatchesPopupStore from "../../../../../../logic/store/useMatchesPopupStore";
import { getMyQuiz } from "../../../../../../logic/api/adoptersApi";
import MatchesPopup, { MATCHES_POPUP_ID } from "./MatchesPopup";
import { MY_QUIZ_QUERY_KEY } from "../../shared/matchQuiz";

const LAUNCHER_ID = "ai-matches-launcher";
const TOOLTIP_ID = "ai-matches-launcher-tooltip";

const MatchesLauncher = () => {
  const role = useAuthStore((state) => state.role);
  const isOpen = useMatchesPopupStore((state) => state.isOpen);
  const hasOpened = useMatchesPopupStore((state) => state.hasOpened);
  const open = useMatchesPopupStore((state) => state.open);
  const closePopup = useMatchesPopupStore((state) => state.close);
  const reset = useMatchesPopupStore((state) => state.reset);
  const [openPetId, setOpenPetId] = useState<number | null>(null);

  // Only for the tooltip's wording — a plain read, it never runs the AI.
  const { data: quiz } = useQuery({
    queryKey: MY_QUIZ_QUERY_KEY,
    queryFn: getMyQuiz,
    enabled: role === "Adopter",
  });
  const tooltip = quiz
    ? "See your top pet matches"
    : "Take our quiz to find your perfect pet match!";

  // Leaving the adopter dashboard (e.g. logging out) starts the next visit —
  // or the next user on this tab — from a closed, unmounted popup.
  useEffect(() => reset, [reset]);

  // Focus goes back to the button. Stable, since the popup's Escape listener
  // depends on it.
  const close = useCallback(() => {
    closePopup();
    document.getElementById(LAUNCHER_ID)?.focus();
  }, [closePopup]);

  const toggle = () => (isOpen ? close() : open());

  if (role !== "Adopter") return null;

  return (
    <>
      {hasOpened && (
        <MatchesPopup
          onClose={close}
          openPetId={openPetId}
          onKnowMore={setOpenPetId}
        />
      )}
      <PetDetailsModal petID={openPetId} onClose={() => setOpenPetId(null)} />

      {/* The tooltip shows on hover and keyboard focus, to the button's left;
          hidden while the popup is open, since it's already in view. */}
      <div className="group fixed bottom-6 right-6 z-30">
        {!isOpen && (
          <span
            id={TOOLTIP_ID}
            role="tooltip"
            className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-neutral-charcoal px-3 py-2 font-body text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {tooltip}
          </span>
        )}
        <ButtonElement
          id={LAUNCHER_ID}
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={hasOpened ? MATCHES_POPUP_ID : undefined}
          aria-label={
            isOpen ? "Close AI matches" : "Find your perfect match with AI"
          }
          aria-describedby={isOpen ? undefined : TOOLTIP_ID}
          size="bare"
          // Hover: the gradient drifts around (the gradient-drift animation in
          // tailwind.config.js). At 300% size the button shows about a third of
          // it at a time: rose→gold at rest, teal→gold at the far end. Teal sits
          // at the end, not the middle, because ease-in-out slows down at the
          // ends and rushes the middle, so the drift eases into teal and gold,
          // holds, and comes back. motion-safe — skipped for anyone who has
          // reduced motion on.
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,theme(colors.rose.md)_0%,theme(colors.gold.md)_30%,theme(colors.teal.md)_67%,theme(colors.gold.md)_100%)] bg-[length:300%_300%] shadow-lg motion-safe:hover:animate-gradient-drift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-md"
        >
          <PiSparkleFill className="h-7 w-7" aria-hidden />
        </ButtonElement>
      </div>
    </>
  );
};

export default MatchesLauncher;
