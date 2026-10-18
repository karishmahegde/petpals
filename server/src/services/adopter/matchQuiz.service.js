const prisma = require("../../config/prisma");
const { MATCH_QUIZ_QUESTIONS } = require("../../config/matchQuiz");

const badRequest = (message) => {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
};

const QUESTIONS_BY_ID = new Map(MATCH_QUIZ_QUESTIONS.map((q) => [q.id, q]));

const isKnownAnswer = (questionId, code) =>
  QUESTIONS_BY_ID.get(questionId)?.options.some((option) => option.code === code) ??
  false;

// Validates the request body's `answers` — { [questionId]: optionCode } — and
// returns it in canonical form (config order). The whole set is required: a
// retake replaces every answer. Unknown questions/options, missing questions
// and wrong types are 400 — the quiz is a closed set, validated strictly.
const parseQuizAnswers = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("answers must be an object mapping question IDs to option codes");
  }

  const unknownQuestions = Object.keys(value).filter((id) => !QUESTIONS_BY_ID.has(id));
  if (unknownQuestions.length > 0) {
    throw badRequest(`Unknown question(s): ${unknownQuestions.join(", ")}`);
  }

  const missing = MATCH_QUIZ_QUESTIONS.filter((q) => !(q.id in value)).map((q) => q.id);
  if (missing.length > 0) {
    throw badRequest(`Every question must be answered — missing: ${missing.join(", ")}`);
  }

  const answers = {};
  for (const { id, options } of MATCH_QUIZ_QUESTIONS) {
    if (!isKnownAnswer(id, value[id])) {
      throw badRequest(
        `Unknown option for ${id}: ${JSON.stringify(value[id])} — use ${options
          .map((option) => option.code)
          .join(", ")}`,
      );
    }
    answers[id] = value[id];
  }
  return answers;
};

// Saved answers as the client sees them. Answers whose question or option code
// has since been removed from the config are dropped, so the client never
// preselects something it can't render.
const toQuizResponse = ({ answers, updatedAt }) => ({
  answers: Object.fromEntries(
    Object.entries(answers).filter(([id, code]) => isKnownAnswer(id, code)),
  ),
  updatedAt,
});

// ——————————————— GET /match-quiz/questions ———————————————
const getQuestions = () => MATCH_QUIZ_QUESTIONS;

// ——————————————— GET /adopters/me/quiz ———————————————
// null when the adopter hasn't taken the quiz yet.
const getMyQuiz = async (adopterID) => {
  const quiz = await prisma.adopterQuiz.findUnique({
    where: { adopterID },
    select: { answers: true, updatedAt: true },
  });
  return quiz ? toQuizResponse(quiz) : null;
};

// ——————————————— PUT /adopters/me/quiz ———————————————
// `answers` is already validated and canonical (parseQuizAnswers). Saving
// clears the adopter's cached matches in the same transaction — they were
// scored against the old answers, and the matcher rebuilds missing rows.
const saveMyQuiz = async (adopterID, answers) => {
  const [quiz] = await prisma.$transaction([
    prisma.adopterQuiz.upsert({
      where: { adopterID },
      create: { adopterID, answers },
      update: { answers },
      select: { answers: true, updatedAt: true },
    }),
    prisma.adopterMatch.deleteMany({ where: { adopterID } }),
  ]);
  return toQuizResponse(quiz);
};

module.exports = {
  parseQuizAnswers,
  getQuestions,
  getMyQuiz,
  saveMyQuiz,
};
