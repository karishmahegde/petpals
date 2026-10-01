import Card from "../../../../components/ui/Card";
import SectionContainer from "../../../../components/ui/marketing/SectionContainer";
import SectionHeading from "../../../../components/ui/marketing/SectionHeading";
import type { LegalSection } from "../../../../static/content/privacy-policy";
import LegalSectionBody from "./LegalSectionBody";

interface LegalSectionsProps {
  sections: LegalSection[];
}

// The document itself: a contents box linking to each numbered section.
const LegalSections = ({ sections }: LegalSectionsProps) => (
  <SectionContainer>
    <div className="mx-auto max-w-3xl">
      <Card className="p-6">
        <h2 className="mb-4 font-display text-2xl text-black">Contents</h2>
        <ol className="grid list-inside list-decimal gap-2 marker:text-rose-dark sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-neutral-charcoal underline-offset-4 hover:text-teal-dark hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </Card>

      {sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className="mt-12 scroll-mt-28"
        >
          <SectionHeading className="my-0 mb-4 flex items-baseline gap-3">
            <span className="font-display text-rose-dark">{index + 1}.</span>
            {section.heading}
          </SectionHeading>
          <LegalSectionBody blocks={section.blocks} />
        </section>
      ))}
    </div>
  </SectionContainer>
);

export default LegalSections;
