import type { IconType } from "react-icons";
import {
  PiCreditCardFill,
  PiLockKeyFill,
  PiShieldCheckFill,
  PiUserGearFill,
} from "react-icons/pi";
import Card from "../../../components/ui/Card";
import SectionContainer from "../../../components/ui/marketing/SectionContainer";
import SectionHeadingCenter from "../../../components/ui/marketing/SectionHeadingCenter";
import { useScrollToHash } from "../../../logic/hooks/useScrollToHash";
import {
  privacyPolicyContent,
  type GlanceIcon,
} from "../../../static/content/privacy-policy";
import LegalContact from "./shared/LegalContact";
import LegalHero from "./shared/LegalHero";
import LegalSections from "./shared/LegalSections";

const glanceIcons: Record<GlanceIcon, IconType> = {
  noSale: PiShieldCheckFill,
  idLock: PiLockKeyFill,
  payments: PiCreditCardFill,
  control: PiUserGearFill,
};

const PrivacyPolicy = () => {
  useScrollToHash();
  const { heroSection, glanceSection, sections, contactSection } =
    privacyPolicyContent;

  return (
    <div className="font-body">
      <LegalHero hero={heroSection} />

      {/* At a glance — Privacy Policy only */}
      <SectionContainer className="bg-gold-light">
        <SectionHeadingCenter className="mt-0">
          {glanceSection.heading}
        </SectionHeadingCenter>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {glanceSection.items.map(({ icon, title, description }) => {
            const Icon = glanceIcons[icon];
            return (
              <Card
                key={title}
                className="flex flex-col items-center p-6 text-center"
              >
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold">
                  <Icon className="h-7 w-7 text-white" aria-hidden="true" />
                </span>
                <h3 className="mb-2 font-semibold text-neutral-dark">
                  {title}
                </h3>
                <p className="text-sm font-light text-neutral-charcoal">
                  {description}
                </p>
              </Card>
            );
          })}
        </div>
      </SectionContainer>

      <LegalSections sections={sections} />
      <LegalContact contact={contactSection} />
    </div>
  );
};

export default PrivacyPolicy;
