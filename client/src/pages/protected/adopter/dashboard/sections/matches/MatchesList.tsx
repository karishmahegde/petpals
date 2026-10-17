// MatchesList.tsx — the adopter's matches in the AI matches popup, each in
// its own card: the pet's photo in a circle beside the match %, name and
// "breed | age | gender"; "why this match" and Know More full width below —
// the photo sits beside only the part that's about its height. The first
// (best) match gets a gold score and a "Best match" tag on its photo. Plus a one-off note
// when every score is rule-based (AI off or unavailable). No fetching or
// state — the caller passes the matches and opens PetDetailsModal from
// onKnowMore.
import { FaPaw } from "react-icons/fa";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import type { AdopterMatch } from "../../../../../../logic/api/adoptersApi";

interface MatchesListProps {
  matches: AdopterMatch[];
  onKnowMore: (petID: number) => void;
}

const MatchesList = ({ matches, onKnowMore }: MatchesListProps) => {
  // AI off or unavailable: there are no "why" lines, so say so once instead
  // of leaving the reasons blank.
  const ruleBasedOnly =
    matches.length > 0 && matches.every((m) => !m.aiExplained);

  return (
    <>
      <ul className="flex flex-col gap-4">
        {matches.map((match, index) => {
          // Matches arrive best first, so the first is the best match.
          const isBest = index === 0;
          return (
            <li
              key={match.petID}
              className="rounded-2xl border border-rose-light bg-rose-lightest/60 p-4"
            >
              {/* Photo beside the short details — about the same height */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {match.petPhoto ? (
                    <img
                      src={match.petPhoto}
                      alt={`${match.petName} photo`}
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white">
                      <FaPaw
                        className="h-10 w-10 text-rose-md"
                        aria-label={`${match.petName} photo placeholder`}
                      />
                    </div>
                  )}
                  {isBest && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-gold-md px-2 py-0.5 font-body text-[10px] font-bold text-white shadow-sm">
                      Best match
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col items-start gap-1">
                  <span
                    className={`rounded-full px-3 py-1 font-body text-sm font-bold ${
                      isBest
                        ? "bg-rose-light text-rose-dark border border-rose-dark"
                        : "bg-teal-light text-teal-dark"
                    }`}
                  >
                    {match.score}% match
                  </span>
                  <p className="mt-1 max-w-full truncate font-body text-md font-bold text-neutral-charcoal">
                    {match.petName}
                  </p>
                  <p className="font-body text-xs font-light text-neutral-charcoal">
                    {match.breed.breedName} | {match.petAge} | {match.petSex}
                  </p>
                </div>
              </div>

              {/* The longer part runs the card's full width below */}
              {match.reason && (
                <div className="mt-4">
                  <p className="font-body text-xs font-bold text-neutral-gray">
                    Why this match
                  </p>
                  <p className="mt-1 font-body text-sm text-neutral-charcoal">
                    {match.reason}
                  </p>
                </div>
              )}
              <ButtonElement
                size="bare"
                onClick={() => onKnowMore(match.petID)}
                aria-label={`Know more about ${match.petName}`}
                className="mt-4 w-full rounded-xl bg-black px-6 py-3 text-xs"
              >
                Know More
              </ButtonElement>
            </li>
          );
        })}
      </ul>
      {ruleBasedOnly && (
        <p className="mt-4 font-body text-xs italic text-neutral-gray">
          Scores are based on your profile and quiz answers. Personalised
          explanations aren't available right now.
        </p>
      )}
    </>
  );
};

export default MatchesList;
