import { PiPawPrintFill } from "react-icons/pi";
import type { LegalSection } from "../../../../static/content/privacy-policy";

interface LegalSectionBodyProps {
  blocks: LegalSection["blocks"];
}

// Renders a section's blocks in order: strings as paragraphs, lists as
// paw-bulleted items under an optional lead-in line.
const LegalSectionBody = ({ blocks }: LegalSectionBodyProps) => (
  <div className="flex flex-col gap-4 font-light text-neutral-charcoal">
    {blocks.map((block, index) =>
      typeof block === "string" ? (
        <p key={index}>{block}</p>
      ) : (
        <div key={index}>
          {block.intro && (
            <p className="mb-2 font-semibold text-neutral-dark">
              {block.intro}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {block.items.map((item) => (
              <li key={item} className="flex gap-3">
                <PiPawPrintFill
                  className="mt-1 h-4 w-4 shrink-0 text-rose-dark"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    )}
  </div>
);

export default LegalSectionBody;
