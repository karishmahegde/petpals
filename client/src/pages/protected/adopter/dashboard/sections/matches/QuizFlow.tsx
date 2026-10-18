// QuizFlow.tsx — the personality quiz inside the AI matches popup
// (MatchesPopup). Loads the questions and any
// saved answers, then runs one question at a time (QuizQuestion) with
// progress via the onboarding stepper and previous answers prefilled on a
// retake. On save it updates the cached quiz, clears the cached matches so
// they're recomputed, and calls onSaved — the popup then shows the matches.
// The progress bar is always the compact ring: the popup is too narrow for
// the full stepper at any screen width.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import OnboardingProgress, {
  type OnboardingStepDef,
} from "../../../../../../components/ui/onboarding/OnboardingProgress";
import OnboardingStepNav from "../../../../../../components/ui/onboarding/OnboardingStepNav";
import QuizQuestion from "./QuizQuestion";
import {
  getMatchQuizQuestions,
  getMyQuiz,
  saveMyQuiz,
  type MatchQuizQuestion,
  type QuizAnswers,
} from "../../../../../../logic/api/adoptersApi";
import {
  MATCHES_QUERY_KEY,
  MATCH_QUIZ_QUESTIONS_QUERY_KEY,
  MY_QUIZ_QUERY_KEY,
} from "../../shared/matchQuiz";

// Short stepper labels per question ID. A question the server adds later
// without a label here falls back to its number.
const QUESTION_LABELS: Record<string, string> = {
  aloneTime: "Weekdays",
  exercise: "Sundays",
  noise: "Noise",
  companionship: "Closeness",
  training: "Training",
  grooming: "Grooming",
  homeVibe: "Home",
  handling: "Rules",
};

const extractError = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.data?.message
    ? String(err.response.data.message)
    : "Something went wrong. Please try again.";

interface QuizFlowProps {
  onSaved: () => void;
}

// Loads the questions and saved answers, then mounts QuizSteps only once
// they're in, so its state starts from the saved answers instead of syncing
// them in later.
const QuizFlow = ({ onSaved }: QuizFlowProps) => {
  const questionsQuery = useQuery({
    queryKey: MATCH_QUIZ_QUESTIONS_QUERY_KEY,
    queryFn: getMatchQuizQuestions,
    staleTime: Infinity, // the question set only changes with a deploy
  });
  const quizQuery = useQuery({
    queryKey: MY_QUIZ_QUERY_KEY,
    queryFn: getMyQuiz,
  });

  const error = questionsQuery.error ?? quizQuery.error;
  const questions = questionsQuery.data;

  if (questionsQuery.isLoading || quizQuery.isLoading) {
    return (
      <p className="font-body text-sm text-neutral-gray">Loading the quiz…</p>
    );
  }
  if (error) {
    return (
      <p className="font-body text-sm text-rose-dark">
        Couldn't load the quiz: {extractError(error)}
      </p>
    );
  }
  if (!questions || questions.length === 0 || !quizQuery.isSuccess) {
    return (
      <p className="font-body text-sm text-neutral-gray">
        The quiz isn't available right now.
      </p>
    );
  }
  return (
    <QuizSteps
      questions={questions}
      savedAnswers={quizQuery.data?.answers ?? {}}
      onSaved={onSaved}
    />
  );
};

interface QuizStepsProps {
  questions: MatchQuizQuestion[];
  savedAnswers: QuizAnswers;
  onSaved: () => void;
}

// Owns the quiz state: the answers so far and the question on screen.
const QuizSteps = ({ questions, savedAnswers, onSaved }: QuizStepsProps) => {
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<QuizAnswers>(savedAnswers);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Focus the new question's heading when the step changes (not on first
  // load), so keyboard and screen-reader users land on it.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  const mutation = useMutation({
    mutationFn: saveMyQuiz,
    onSuccess: (quiz) => {
      queryClient.setQueryData(MY_QUIZ_QUERY_KEY, quiz);
      // Removed, not just invalidated: an invalidated query keeps showing its
      // old data while it refetches — the pre-quiz "Take the quiz" state —
      // for the few seconds the new matches take. With nothing cached, the
      // matches views show their loading state instead.
      queryClient.removeQueries({ queryKey: MATCHES_QUERY_KEY });
      onSaved();
    },
    onError: (err) => setError(extractError(err)),
  });

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const firstUnanswered = questions.findIndex((q) => !answers[q.id]);

  const steps: OnboardingStepDef[] = questions.map((q, i) => ({
    step: i + 1,
    label: QUESTION_LABELS[q.id] ?? `Question ${i + 1}`,
  }));

  const handleSelect = (code: string) => {
    setError(null);
    setAnswers((prev) => ({ ...prev, [question.id]: code }));
  };

  const handleContinue = () => {
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    // Only the current questions' answers — a saved answer to a question
    // since removed would be a 400.
    mutation.mutate(
      Object.fromEntries(questions.map((q) => [q.id, answers[q.id]])),
    );
  };

  const body = (
    <>
      <QuizQuestion
        key={question.id}
        question={question}
        questionNumber={index + 1}
        total={questions.length}
        selected={answers[question.id]}
        onSelect={handleSelect}
        headingRef={headingRef}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-rose-lightest px-4 py-2 font-body text-sm text-rose-dark">
          {error}
        </p>
      )}

      <OnboardingStepNav
        onBack={index > 0 ? () => setIndex(index - 1) : undefined}
        onContinue={handleContinue}
        continueLabel={isLast ? "Save answers" : "Next"}
        isPending={mutation.isPending}
        disabled={!answers[question.id] || (isLast && firstUnanswered !== -1)}
      />
    </>
  );

  return (
    <>
      <OnboardingProgress
        steps={steps}
        currentStep={index + 1}
        furthestStep={
          firstUnanswered === -1 ? questions.length + 1 : firstUnanswered + 1
        }
        compact
      />
      {body}
    </>
  );
};

export default QuizFlow;
