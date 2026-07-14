// components/ui/SectionHeading.tsx
interface SectionHeadingCenterProps {
  children: React.ReactNode;
  className?: string;
}

const SectionHeadingCenter = ({
  children,
  className = "",
}: SectionHeadingCenterProps) => (
  <h2
    className={`text-3xl lg:text-4xl my-8 font-bold text-black text-center ${className}`}
  >
    {children}
  </h2>
);

export default SectionHeadingCenter;
