// components/ui/DemoNotice.tsx
// A soft gold callout reminding visitors that PetPals is a portfolio demo —
// shown where people are asked for personal details (sign-up, government ID
// upload). Gold, not rose: rose-lightest is the error colour.
import type { ReactNode } from "react";
import { HiOutlineInformationCircle } from "react-icons/hi";

interface DemoNoticeProps {
  children: ReactNode;
  /** Layout-only overrides, e.g. a margin. */
  className?: string;
}

const DemoNotice = ({ children, className = "" }: DemoNoticeProps) => (
  <p
    role="note"
    className={`flex items-start gap-2 rounded-lg bg-gold-lightest px-4 py-2.5 font-body text-xs text-neutral-charcoal ${className}`}
  >
    <HiOutlineInformationCircle aria-hidden className="mt-px h-4 w-4 shrink-0 text-gold-dark" />
    <span>{children}</span>
  </p>
);

export default DemoNotice;
