// components/ui/SectionHeading.tsx
interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

const SectionHeading = ({ children, className = "" }: SectionHeadingProps) => (
  <h2 className={`text-3xl lg:text-4xl my-8 font-bold text-black ${className}`}>
    {children}
  </h2>
);

export default SectionHeading;
