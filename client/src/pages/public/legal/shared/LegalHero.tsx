import SectionContainer from "../../../../components/ui/marketing/SectionContainer";
import SectionHeadingCenter from "../../../../components/ui/marketing/SectionHeadingCenter";
import type { LegalHeroContent } from "../../../../static/content/privacy-policy";

interface LegalHeroProps {
  hero: LegalHeroContent;
}

const LegalHero = ({ hero }: LegalHeroProps) => (
  <SectionContainer className="bg-rose">
    <div className="mx-auto max-w-3xl text-center">
      <SectionHeadingCenter>{hero.heading}</SectionHeadingCenter>
      <p className="font-light">{hero.description}</p>
      <p className="mt-6 inline-block rounded-full bg-white px-4 py-1 text-sm font-semibold text-rose-dark">
        Last updated: {hero.lastUpdated}
      </p>
    </div>
  </SectionContainer>
);

export default LegalHero;
