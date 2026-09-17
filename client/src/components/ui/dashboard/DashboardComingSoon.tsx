// components/ui/dashboard/DashboardComingSoon.tsx
// Placeholder page body for a dashboard route whose navigation exists but
// whose real content lands in a later sprint (see each page file that uses
// this for which sprint). Generic across roles — not adopter/staff/admin
// specific — so any dashboard can scaffold its full information
// architecture ahead of building each section.
import DashboardHeading from "./DashboardHeading";
import DashboardEmptyMessage from "./DashboardEmptyMessage";

interface DashboardComingSoonProps {
  title: string;
  emoji?: string;
}

const DashboardComingSoon = ({ title, emoji }: DashboardComingSoonProps) => (
  <>
    <DashboardHeading
      title={title}
      emoji={emoji}
      message="This section is on the way."
    />
    <div className="rounded-2xl border border-dashed border-neutral-gray/40 bg-white p-10 text-center">
      <DashboardEmptyMessage>
        {title} is coming in a future sprint — check back soon.
      </DashboardEmptyMessage>
    </div>
  </>
);

export default DashboardComingSoon;
