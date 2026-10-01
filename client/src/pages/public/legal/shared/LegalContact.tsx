import ButtonElement from "../../../../components/ui/ButtonElement";
import SectionContainer from "../../../../components/ui/marketing/SectionContainer";
import SectionHeadingCenter from "../../../../components/ui/marketing/SectionHeadingCenter";
import type { LegalContactContent } from "../../../../static/content/privacy-policy";

interface LegalContactProps {
  contact: LegalContactContent;
}

const LegalContact = ({ contact }: LegalContactProps) => (
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
        <ButtonElement to="/faqs" className="bg-teal-dark hover:bg-gold-dark">
          Read Our FAQs
        </ButtonElement>
      </div>
    </div>
  </SectionContainer>
);

export default LegalContact;
