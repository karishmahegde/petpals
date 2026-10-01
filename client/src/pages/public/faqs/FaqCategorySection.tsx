import { FaChevronDown } from "react-icons/fa";
import { PiPawPrintFill } from "react-icons/pi";
import ButtonElement from "../../../components/ui/ButtonElement";
import Card from "../../../components/ui/Card";
import type { FaqCategory } from "../../../static/content/faqs";

interface FaqCategorySectionProps {
  category: FaqCategory;
  openQuestions: string[];
  onToggle: (question: string) => void;
}

const FaqCategorySection = ({
  category,
  openQuestions,
  onToggle,
}: FaqCategorySectionProps) => (
  <div>
    <h3 className="mb-4 flex items-center gap-2 font-display text-2xl text-black lg:text-3xl">
      <PiPawPrintFill className="h-5 w-5 text-rose-dark" aria-hidden="true" />
      {category.heading}
    </h3>
    <Card className="divide-y divide-neutral-lightgray">
      {category.items.map((item) => {
        const isOpen = openQuestions.includes(item.question);
        return (
          <div key={item.question} className="px-5 py-4">
            <ButtonElement
              onClick={() => onToggle(item.question)}
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
);

export default FaqCategorySection;
