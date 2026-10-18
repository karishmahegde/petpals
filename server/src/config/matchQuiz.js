// The adopter personality quiz behind the compatibility matcher — the single
// source of truth for the questions, their options and the personality titles.
// GET /match-quiz/questions serves it as-is; PUT /adopters/me/quiz validates
// answers against it.
//
// Saved answers store each option's `code`, never its wording, so the copy can
// change freely. Changing or removing a code invalidates answers already saved
// with it — add a new code instead.
//
// Options are ordered from MOST to LEAST on the trait the question measures
// (most time together, most exercise, most noise-tolerant, …): the matcher and
// the personality title read an option's position, not its wording.

const MATCH_QUIZ_QUESTIONS = [
  {
    id: "aloneTime",
    prompt: "What would your pet's diary say about a typical weekday?",
    options: [
      { code: "rarely", emoji: "🏡", label: "\"My human never left. We even had lunch together.\"" },
      { code: "fewHours", emoji: "☕", label: "\"They popped out for a bit, then we hung out all afternoon.\"" },
      { code: "workday", emoji: "💼", label: "\"Long nap while they were at work, big welcome at dinner.\"" },
      { code: "longDays", emoji: "🌙", label: "\"They left early and got home late. Lots of me-time.\"" },
    ],
  },
  {
    id: "exercise",
    prompt: "Pick your perfect Sunday with your new pet.",
    options: [
      { code: "over2h", emoji: "🏔️", label: "Sunrise hike, then a swim" },
      { code: "oneToTwoH", emoji: "🌳", label: "A long park walk and a café stop" },
      { code: "halfToOneH", emoji: "🧺", label: "A short stroll, then a lazy afternoon" },
      { code: "under30m", emoji: "🍿", label: "Blankets, snacks, movie marathon" },
    ],
  },
  {
    id: "noise",
    prompt: "Your new roommate starts singing at 7 AM. You…",
    options: [
      { code: "loves", emoji: "😄", label: "Join in. The louder the better" },
      { code: "moderate", emoji: "😅", label: "Smile, as long as it's not every morning" },
      { code: "quiet", emoji: "😬", label: "Reach for the earplugs" },
    ],
  },
  {
    id: "companionship",
    prompt: "You're reading on the couch. Your ideal pet is…",
    options: [
      { code: "shadow", emoji: "🐾", label: "Glued to your side, possibly sitting on the book" },
      { code: "nearby", emoji: "💛", label: "Curled up nearby, checking in now and then" },
      { code: "independent", emoji: "🌙", label: "Off on their own adventure, stopping by to say hi" },
    ],
  },
  {
    id: "training",
    prompt: "Your new pet just knocked your mug off the table. Your first thought?",
    options: [
      { code: "teach", emoji: "🎓", label: "\"Teaching moment, let's work on it!\"" },
      { code: "reinforce", emoji: "🙂", label: "\"We'll practise the basics together.\"" },
      { code: "trained", emoji: "😩", label: "\"I was hoping they'd know better already.\"" },
    ],
  },
  {
    id: "grooming",
    prompt: "Fur (or feathers) on your favourite sweater:",
    options: [
      { code: "daily", emoji: "🪮", label: "Comes with the territory. I'll brush every day" },
      { code: "weekly", emoji: "🧻", label: "A lint roller and a weekly brush, deal" },
      { code: "minimal", emoji: "🙅", label: "Please, no. Low-maintenance only" },
    ],
  },
  {
    id: "homeVibe",
    prompt: "If your home were a playlist, it would be…",
    options: [
      { code: "lively", emoji: "🎉", label: "Party mix: friends, kids, always something going on" },
      { code: "between", emoji: "🎧", label: "Coffee-shop indie: busy, then calm" },
      { code: "calm", emoji: "🎻", label: "Lo-fi or classical: calm and quiet" },
    ],
  },
  {
    id: "handling",
    prompt: "Your pet decides your house rules are more like suggestions. You…",
    options: [
      { code: "confident", emoji: "🧭", label: "Love the challenge. Calm, firm and consistent wins" },
      { code: "guided", emoji: "📚", label: "Read up and ask a trainer for tips" },
      { code: "easygoing", emoji: "🕊️", label: "Would rather have a pet who goes with the flow" },
    ],
  },
];

// The fun title shown above the adopter's matches — worked out from the
// answers by rules, never by the AI. Two axes, each the average of its
// questions' option positions (first option = 1, last = 0):
//   energy    — exercise, homeVibe, noise
//   closeness — aloneTime, companionship
// An axis reads "high" at or above HIGH, "low" at or below LOW, else "mid".
// Mid energy is always the Balanced Best Friend. At either end of the energy
// axis, low closeness picks the independent title (Free Spirit / Easygoing
// Roommate) and mid or high closeness the together one (Adventure Buddy /
// Cozy Companion).
const PERSONALITY_AXES = {
  energy: ["exercise", "homeVibe", "noise"],
  closeness: ["aloneTime", "companionship"],
};
const PERSONALITY_THRESHOLDS = { HIGH: 0.6, LOW: 0.4 };

const PERSONALITY_TYPES = {
  adventureBuddy: {
    title: "The Adventure Buddy",
    blurb:
      "Life's better with a sidekick. You're after an energetic pet who's up for anything, as long as you do it together.",
  },
  freeSpirit: {
    title: "The Free Spirit",
    blurb:
      "Always on the move and happy to give a pet room to roam. An active, independent companion fits right in.",
  },
  balancedBestFriend: {
    title: "The Balanced Best Friend",
    blurb:
      "A bit of play, a bit of downtime. You'd suit an adaptable pet who's happy either way.",
  },
  cozyCompanion: {
    title: "The Cozy Companion",
    blurb:
      "Slow mornings and couch snuggles. You're looking for a calm pet who loves being close.",
  },
  easygoingRoommate: {
    title: "The Easygoing Roommate",
    blurb:
      "Calm home, relaxed routine. A low-key, independent pet would happily share your space.",
  },
};

module.exports = {
  MATCH_QUIZ_QUESTIONS,
  PERSONALITY_AXES,
  PERSONALITY_THRESHOLDS,
  PERSONALITY_TYPES,
};
