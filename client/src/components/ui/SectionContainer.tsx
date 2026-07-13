// components/ui/SectionContainer.tsx
interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
}

const SectionContainer = ({
  children,
  className = "",
}: SectionContainerProps) => (
  <section className={`p-6 lg:p-28 ${className}`}>{children}</section>
);

export default SectionContainer;
