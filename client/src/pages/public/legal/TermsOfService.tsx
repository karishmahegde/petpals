import { useScrollToHash } from "../../../logic/hooks/useScrollToHash";
import { termsOfServiceContent } from "../../../static/content/terms-of-service";
import LegalContact from "./shared/LegalContact";
import LegalHero from "./shared/LegalHero";
import LegalSections from "./shared/LegalSections";

const TermsOfService = () => {
  useScrollToHash();
  const { heroSection, sections, contactSection } = termsOfServiceContent;

  return (
    <div className="font-body">
      <LegalHero hero={heroSection} />
      <LegalSections sections={sections} />
      <LegalContact contact={contactSection} />
    </div>
  );
};

export default TermsOfService;
