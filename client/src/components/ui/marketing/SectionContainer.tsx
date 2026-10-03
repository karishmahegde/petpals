// components/ui/marketing/SectionContainer.tsx
import { forwardRef } from "react";

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  // Anchor target for `#hash` links; pair with a `scroll-mt-*` class so the
  // sticky navbar doesn't cover the section's top.
  id?: string;
}

const SectionContainer = forwardRef<HTMLElement, SectionContainerProps>(
  ({ children, className = "", id }, ref) => (
    <section ref={ref} id={id} className={`p-6 lg:p-28 ${className}`}>
      {children}
    </section>
  ),
);

export default SectionContainer;
