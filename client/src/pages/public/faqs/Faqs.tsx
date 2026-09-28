import { PiPawPrintFill } from "react-icons/pi";
import ButtonElement from "../../../components/ui/ButtonElement";
import SectionContainer from "../../../components/ui/marketing/SectionContainer";
import SectionHeadingCenter from "../../../components/ui/marketing/SectionHeadingCenter";
// import { faqsContent } from "../../../static/content/faqs";

const Faqs = () => {
  // const { heroSection, categories, contactSection } = faqsContent;

  return (
    <div className="font-body">
      <SectionContainer className="bg-teal-light">
        <SectionHeadingCenter>Frequently Asked Questions</SectionHeadingCenter>
      </SectionContainer>

      <SectionContainer className="bg-gold-light">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl bg-neutral-offwhite p-8 text-center lg:p-12">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-dark text-white">
            <PiPawPrintFill className="h-8 w-8" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-display text-3xl text-black">Coming Soon</h3>
          <p className="mt-3 font-light text-neutral-charcoal">
            We're busy fetching answers to your questions. Check back soon!
          </p>
          <ButtonElement to="/adopt" className="bg-teal-dark hover:bg-gold-dark">
            Meet Our Pets
          </ButtonElement>
        </div>
      </SectionContainer>

      {/* <h1>{heroSection.heading}</h1>
      <p>{heroSection.description}</p>

      {categories.map((category) => (
        <section key={category.heading}>
          <h2>{category.heading}</h2>
          {category.items.map((item) => (
            <div key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
      ))}

      <h2>{contactSection.heading}</h2>
      <p>{contactSection.description}</p>
      <p>
        <a href={`mailto:${contactSection.email}`}>{contactSection.email}</a>
      </p> */}
    </div>
  );
};

export default Faqs;
