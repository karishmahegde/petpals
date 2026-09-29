import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { PiPawPrintFill } from "react-icons/pi";
import ButtonElement from "../../../components/ui/ButtonElement";
import Card from "../../../components/ui/Card";
import SectionContainer from "../../../components/ui/marketing/SectionContainer";
import SectionHeading from "../../../components/ui/marketing/SectionHeading";
import SectionHeadingCenter from "../../../components/ui/marketing/SectionHeadingCenter";
import { faqsContent } from "../../../static/content/faqs";
import FaqImage from "./FaqImage";

const Faqs = () => {
  const { heroSection, sideImage, categories, contactSection } = faqsContent;
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
      <SectionContainer className="bg-teal-light">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <SectionHeading>{heroSection.heading}</SectionHeading>
            <p className="text-justify font-light">{heroSection.description}</p>
          </div>
          <FaqImage image={heroSection.image} className="aspect-[4/3]" />
        </div>
      </SectionContainer>

      {/* Section 2 */}
      <SectionContainer className="bg-gold-light">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="flex flex-col gap-10 lg:col-span-2">
            {categories.map((category) => (
              <div key={category.heading}>
                <h3 className="mb-4 flex items-center gap-2 font-display text-2xl text-black lg:text-3xl">
                  <PiPawPrintFill
                    className="h-5 w-5 text-rose-dark"
                    aria-hidden="true"
                  />
                  {category.heading}
                </h3>
                <Card className="divide-y divide-neutral-lightgray">
                  {category.items.map((item) => {
                    const isOpen = openQuestions.includes(item.question);
                    return (
                      <div key={item.question} className="px-5 py-4">
                        <ButtonElement
                          onClick={() => toggleQuestion(item.question)}
                          aria-expanded={isOpen}
                          size="bare"
                          variant="outline"
                          className="flex w-full items-center justify-between gap-4 text-left font-semibold text-neutral-dark"
                        >
                          {item.question}
                          <FaChevronDown
                            className={`shrink-0 text-neutral-gray transition-transform ${isOpen ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </ButtonElement>
                        {isOpen && (
                          <p className="mt-3 text-sm font-light text-neutral-charcoal">
                            {item.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <FaqImage
              image={sideImage}
              className="sticky top-28 aspect-[3/4]"
            />
          </div>
        </div>
      </SectionContainer>

      {/* Section 3 */}
      <SectionContainer className="bg-rose">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <FaqImage
            image={contactSection.image}
            className="order-last aspect-[4/3] md:order-first"
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
