import { useState } from "react";
import ButtonElement from "../../../components/ui/ButtonElement";
import SectionContainer from "../../../components/ui/marketing/SectionContainer";
import SectionHeading from "../../../components/ui/marketing/SectionHeading";
import SectionHeadingCenter from "../../../components/ui/marketing/SectionHeadingCenter";
import { faqsContent } from "../../../static/content/faqs";
import FaqCategorySection from "./FaqCategorySection";
import FaqImage from "./FaqImage";

const Faqs = () => {
  const { heroSection, categories, contactSection } = faqsContent;
  // Several answers can be open at once; questions are unique, so they
  // double as keys.
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);

  const toggleQuestion = (question: string) =>
    setOpenQuestions((open) =>
      open.includes(question)
        ? open.filter((q) => q !== question)
        : [...open, question],
    );

  return (
    <div className="font-body">
      {/* Section 1 */}
      <SectionContainer className="bg-rose">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <SectionHeading>{heroSection.heading}</SectionHeading>
            <p className="text-justify font-light">{heroSection.description}</p>
          </div>
          <FaqImage
            image={heroSection.image}
            className="mx-auto aspect-square max-w-xs md:max-w-sm"
          />
        </div>
      </SectionContainer>

      {/* Section 2 */}
      <SectionContainer className="bg-gold-light">
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          {categories.map((category) => (
            <FaqCategorySection
              key={category.heading}
              category={category}
              openQuestions={openQuestions}
              onToggle={toggleQuestion}
            />
          ))}
        </div>
      </SectionContainer>

      {/* Section 3 */}
      <SectionContainer className="bg-teal-light">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <FaqImage
            image={contactSection.image}
            className="order-last mx-auto aspect-square max-w-xs md:order-first md:max-w-sm"
          />
          <div className="text-center md:text-left">
            <SectionHeadingCenter className="md:text-left">
              {contactSection.heading}
            </SectionHeadingCenter>
            <p className="font-light">{contactSection.description}</p>
            <a
              href={`mailto:${contactSection.email}`}
              className="mt-4 inline-block font-semibold text-neutral-dark underline hover:text-teal-dark"
            >
              {contactSection.email}
            </a>
            <div>
              <ButtonElement
                to="/adopt"
                className="bg-teal-dark hover:bg-gold-dark"
              >
                Meet Our Pets
              </ButtonElement>
            </div>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

export default Faqs;
