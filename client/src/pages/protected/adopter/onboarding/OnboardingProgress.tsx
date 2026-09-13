// OnboardingProgress.tsx
// The 7-node progress bar from the mockup: a gold connector line, green
// checkmark circles for completed steps, a teal-dark numbered circle for
// the step being viewed, and muted teal-light circles for the rest. Step 1
// (Account) is never actually routed to — it's always shown complete.
import { PiCheckBold } from "react-icons/pi";

interface OnboardingProgressProps {
  currentStep: number; // 2-7, the step being displayed
  furthestStep: number; // adopter.onboardingStep — steps before this are done
  // "Skip for now" — rendered right below "% Completed", same styling,
  // right-aligned. Omitted on Review (Step 7), where Submit is the real
  // completion action.
  onSkip?: () => void;
}

const STEPS = [
  { step: 1, label: "Account" },
  { step: 2, label: "Personal" },
  { step: 3, label: "Identity" },
  { step: 4, label: "Household" },
  { step: 5, label: "Lifestyle" },
  { step: 6, label: "Preferences" },
  { step: 7, label: "Review" },
];

// Ring geometry for the mobile progress circle — radius chosen so a 48px
// (h-12/w-12) circle has enough room for a few px of stroke without the
// arc clipping the tile's edges.
const RING_SIZE = 48;
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const OnboardingProgress = ({
  currentStep,
  furthestStep,
  onSkip,
}: OnboardingProgressProps) => {
  const percent = Math.round((currentStep / 7) * 100);
  const currentLabel = STEPS.find((s) => s.step === currentStep)?.label ?? "";
  const ringOffset = RING_CIRCUMFERENCE * (1 - currentStep / 7);

  return (
    <div className="mb-8">
      {/* Mobile — the full 7-node stepper doesn't fit a narrow screen, so it
          collapses to a single "current step of 7 · name … % complete" row
          instead of a squished/scrolling version of the desktop layout. */}
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <svg
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="absolute inset-0 h-full w-full -rotate-90"
              aria-hidden
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3.5"
                className="stroke-neutral-lightgray"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className="stroke-green"
              />
            </svg>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green/15">
              <span className="font-body text-[10px] font-bold text-neutral-dark">
                {currentStep} of 7
              </span>
            </div>
          </div>
          <span className="font-body text-sm font-bold text-neutral-dark">
            {currentLabel}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-body text-sm text-rose-dark">
            {percent}% Completed
          </span>
          {onSkip && (
            <>
              <button
                type="button"
                onClick={onSkip}
                className="font-body text-sm text-rose-dark hover:underline"
              >
                Skip for now
              </button>
              <span className="max-w-[160px] font-body text-xs italic text-neutral-gray">
                These details are required for adoption applications.
              </span>
            </>
          )}
        </div>
      </div>

      {/* sm and up — full stepper */}
      <div className="hidden sm:block">
        <div className="relative">
          <div className="absolute left-5 right-5 top-5 h-0.5 bg-gold" />
          <div className="relative flex justify-between">
            {STEPS.map((s) => {
              const isActive = s.step === currentStep;
              const isComplete =
                !isActive && (s.step === 1 || s.step < furthestStep);
              return (
                <div key={s.step} className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${
                      isComplete
                        ? "bg-green text-white"
                        : isActive
                          ? "bg-teal-dark text-white"
                          : "bg-teal-light text-teal-dark"
                    }`}
                  >
                    {isComplete ? <PiCheckBold aria-hidden /> : s.step}
                  </div>
                  <span
                    className={`mt-2 font-body text-xs ${
                      isActive
                        ? "font-bold text-neutral-dark"
                        : "text-neutral-gray"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between font-body text-sm text-rose-dark">
          <span>Step {currentStep} of 7</span>
          <div className="flex flex-col items-end gap-1">
            <span>{percent}% Completed</span>
            {onSkip && (
              <>
                <button
                  type="button"
                  onClick={onSkip}
                  className="font-body text-sm text-rose-dark hover:underline"
                >
                  Skip for now
                </button>
                <span className="max-w-[220px] text-right font-body text-xs italic text-neutral-gray">
                  These details are required for adoption applications.
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingProgress;
