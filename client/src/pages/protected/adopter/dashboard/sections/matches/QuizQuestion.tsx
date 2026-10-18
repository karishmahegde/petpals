// QuizQuestion.tsx — one personality-quiz question, chat style: the question
// arrives as a PetPals message bubble, the fixed options sit below it as a
// radio group, and the chosen one is echoed back as the adopter's reply.
// Keeps no state — QuizFlow owns the answers.
//
// Keyboard: Tab lands on the selected option (or the first); the arrow keys,
// Home and End move between options and select as they go, the standard
// radio-group pattern.
import { type KeyboardEvent, type RefObject } from "react";
import ButtonElement from "../../../../../../components/ui/ButtonElement";
import type { MatchQuizQuestion } from "../../../../../../logic/api/adoptersApi";

interface QuizQuestionProps {
  question: MatchQuizQuestion;
  questionNumber: number;
  total: number;
  selected: string | undefined;
  onSelect: (code: string) => void;
  // QuizFlow moves focus here on each new question, so screen readers
  // announce it.
  headingRef: RefObject<HTMLHeadingElement | null>;
}

const QuizQuestion = ({
  question,
  questionNumber,
  total,
  selected,
  onSelect,
  headingRef,
}: QuizQuestionProps) => {
  const headingId = `quiz-question-${question.id}`;
  const selectedIndex = question.options.findIndex((o) => o.code === selected);
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const selectedOption = question.options[selectedIndex];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = question.options.length;
    const current = selectedIndex === -1 ? -1 : selectedIndex;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = (current + 1) % count;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = current <= 0 ? count - 1 : current - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = count - 1;
    }
    if (next === null) return;

    event.preventDefault();
    onSelect(question.options[next].code);
    const radios =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios[next]?.focus();
  };

  return (
    <div>
      {/* PetPals asks */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-light bg-rose-lightest text-lg"
          aria-hidden
        >
          🐾
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-rose-lightest px-4 py-3">
          <p className="font-body text-xs text-neutral-gray">
            Question {questionNumber} of {total}
          </p>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-xl text-neutral-dark focus:outline-none"
          >
            {question.prompt}
          </h2>
        </div>
      </div>

      {/* The fixed replies */}
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        onKeyDown={handleKeyDown}
        className="mt-5 flex flex-col gap-2 sm:pl-12"
      >
        {question.options.map((option, index) => {
          const isSelected = option.code === selected;
          return (
            <ButtonElement
              key={option.code}
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusableIndex ? 0 : -1}
              onClick={() => onSelect(option.code)}
              size="bare"
              variant="outline"
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark ${
                isSelected
                  ? "bg-rose text-white"
                  : "bg-neutral-offwhite text-neutral-charcoal hover:brightness-95"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {option.emoji}
              </span>
              <span>{option.label}</span>
            </ButtonElement>
          );
        })}
      </div>

      {/* The adopter's reply — a visual echo of the checked option, which
          screen readers already announce. */}
      {selectedOption && (
        <div className="mt-4 flex justify-end" aria-hidden>
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-teal-dark px-4 py-2 font-body text-sm text-white">
            {selectedOption.emoji} {selectedOption.label}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizQuestion;
