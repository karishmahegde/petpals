// OnboardingStepHeader.tsx
// Icon chip + heading + helper sentence — the header every wizard step
// (2-7) opens with, per the mockup's "About your Home" treatment.
import { ReactNode } from "react";

interface OnboardingStepHeaderProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const OnboardingStepHeader = ({
  icon,
  title,
  description,
}: OnboardingStepHeaderProps) => (
  <div className="mb-6">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-light bg-rose-lightest text-2xl text-rose-dark">
      {icon}
    </div>
    <h2 className="font-display text-2xl text-neutral-dark">{title}</h2>
    <p className="mt-1 font-body text-sm text-neutral-gray">{description}</p>
  </div>
);

export default OnboardingStepHeader;
