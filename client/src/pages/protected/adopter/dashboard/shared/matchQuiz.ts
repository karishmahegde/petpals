// Query keys and the top-matches query for the compatibility matcher, shared
// by the AI matches popup, its quiz flow and the Profile quiz card. Saving
// the quiz removes MATCHES_QUERY_KEY, so every matches query must sit under it.
import { getMyMatches } from "../../../../../logic/api/adoptersApi";

export const MATCH_QUIZ_QUESTIONS_QUERY_KEY = [
  "matchQuiz",
  "questions",
] as const;
export const MY_QUIZ_QUERY_KEY = ["adopter", "quiz"] as const;
export const MATCHES_QUERY_KEY = ["adopter", "matches"] as const;

// The top 3 matches shown in the popup. The key includes the limit, the
// only thing queryFn reads.
const TOP_MATCHES_LIMIT = 3;
export const topMatchesQuery = {
  queryKey: [...MATCHES_QUERY_KEY, TOP_MATCHES_LIMIT],
  queryFn: () => getMyMatches(TOP_MATCHES_LIMIT),
};
