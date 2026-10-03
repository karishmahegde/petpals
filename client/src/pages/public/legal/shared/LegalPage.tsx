import { PiPawPrintFill } from "react-icons/pi";
import ButtonElement from "../../../../components/ui/ButtonElement";
import Card from "../../../../components/ui/Card";
import SectionContainer from "../../../../components/ui/marketing/SectionContainer";
import SectionHeading from "../../../../components/ui/marketing/SectionHeading";
import SectionHeadingCenter from "../../../../components/ui/marketing/SectionHeadingCenter";
import { useScrollToHash } from "../../../../logic/hooks/useScrollToHash";
import type {
  LegalContactContent,
  LegalHeroContent,
  LegalSection,
} from "../../../../static/content/privacy-policy";

interface LegalPageProps {
  hero: LegalHeroContent;
  sections: LegalSection[];
  contact: LegalContactContent;
  // Page-specific extras, rendered between the hero and the document.
  children?: React.ReactNode;
}

// Shared layout for Privacy Policy and Terms of Service: hero, a contents box
// linking to each numbered section, then a contact section.
const LegalPage = ({ hero, sections, contact, children }: LegalPageProps) => {
  useScrollToHash();

  return (
    <div className="font-body">
      {/* Hero */}
      <SectionContainer className="bg-rose">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeadingCenter>{hero.heading}</SectionHeadingCenter>
          <p className="font-light">{hero.description}</p>
          <p className="mt-6 inline-block rounded-full bg-white px-4 py-1 text-sm font-semibold text-rose-dark">
            Last updated: {hero.lastUpdated}
          </p>
        </div>
      </SectionContainer>

      {children}

      {/* Document */}
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
                <span className="font-display text-rose-dark">
                  {index + 1}.
                </span>
                {section.heading}
              </SectionHeading>
              {/* A string block is a paragraph, an object a bulleted list. */}
              <div className="flex flex-col gap-4 font-light text-neutral-charcoal">
                {section.blocks.map((block, blockIndex) =>
                  typeof block === "string" ? (
                    <p key={blockIndex}>{block}</p>
                  ) : (
                    <div key={blockIndex}>
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
            </section>
          ))}
        </div>
      </SectionContainer>

      {/* Contact */}
      <SectionContainer className="bg-teal-light">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeadingCenter className="mt-0">
            {contact.heading}
          </SectionHeadingCenter>
          <p className="font-light">{contact.description}</p>
          <a
            href={`mailto:${contact.email}`}
            className="mt-4 inline-block font-semibold text-neutral-dark underline hover:text-teal-dark"
          >
            {contact.email}
          </a>
          <div>
            <ButtonElement
              to="/faqs"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              Read Our FAQs
            </ButtonElement>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

export default LegalPage;
