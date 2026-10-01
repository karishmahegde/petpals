import { termsOfServiceContent } from "../../../static/content/terms-of-service";
import LegalPage from "./shared/LegalPage";

const TermsOfService = () => {
  const { heroSection, sections, contactSection } = termsOfServiceContent;

  return (
    <LegalPage
      hero={heroSection}
      sections={sections}
      contact={contactSection}
    />
  );
};

export default TermsOfService;
