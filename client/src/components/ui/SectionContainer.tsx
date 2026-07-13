// components/ui/SectionContainer.tsx
import { forwardRef } from "react";

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
}

const SectionContainer = forwardRef<HTMLElement, SectionContainerProps>(
  ({ children, className = "" }, ref) => (
    <section ref={ref} className={`p-6 lg:p-28 ${className}`}>
      {children}
    </section>
  ),
);

export default SectionContainer;
