// components/ui/onboarding/OnboardingStepNav.tsx
// The Back / Continue (or Submit) row every onboarding wizard step ends
// with. Back is omitted on a wizard's first step (no onBack).
import ButtonElement from "../ButtonElement";

interface OnboardingStepNavProps {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
}

const OnboardingStepNav = ({
  onBack,
  onContinue,
  continueLabel = "Continue",
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
}: OnboardingStepNavProps) => (
  <div className="mt-6 flex gap-3">
    {onBack && (
      <ButtonElement
        onClick={onBack}
        size="panel"
        className="flex-1 bg-gold hover:brightness-95 disabled:cursor-not-allowed"
      >
        Back
      </ButtonElement>
    )}
    <ButtonElement
      onClick={onContinue}
      disabled={disabled || isPending}
      size="panel"
      className="flex-1 bg-teal-dark hover:brightness-95 disabled:cursor-not-allowed"
    >
      {isPending ? pendingLabel : continueLabel}
    </ButtonElement>
  </div>
);

export default OnboardingStepNav;
