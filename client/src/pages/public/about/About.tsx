import { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import SectionContainer from "../../../components/ui/SectionContainer";
import SectionHeading from "../../../components/ui/SectionHeading";
import SectionHeadingCenter from "../../../components/ui/SectionHeadingCenter";
import ButtonElement from "../../../components/ui/ButtonElement";
import { aboutContent } from "../../../static/content/about";

const About = () => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const impactRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!impactRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setHasAnimated(true);
      },
      { threshold: 0.6 },
    );
    observer.observe(impactRef.current);
    return () => observer.disconnect();
  }, []);

  const {
    believeSection,
    ourStorySection,
    missionSection,
    teamSection,
    impactSection,
    testimonials,
    joinMissionSection,
  } = aboutContent;
  return (
    <div className="font-body">
      {/* Section 1 */}
      <SectionContainer className="bg-gold-light">
        <SectionHeadingCenter>{believeSection.heading}</SectionHeadingCenter>
        <div className="text-center">
          <p className="text-md font-light">{believeSection.description}</p>
          <ButtonElement
            to="/adopt"
            className="bg-teal-dark hover:bg-gold-dark"
          >
            {believeSection.button}
          </ButtonElement>
        </div>
      </SectionContainer>

      {/* Section 2 */}
      <SectionContainer className="bg-rose-light">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <SectionHeading>{ourStorySection.heading}</SectionHeading>
            <p className="text-justify font-light">
              {ourStorySection.description}
            </p>
          </div>

          <div className="flex items-center justify-center text-center md:p-5">
            <div className="flex w-full items-center justify-center text-neutral-gray">
              <img
                src={ourStorySection.image}
                alt="Adopt a Pet"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      </SectionContainer>

      {/* Section 3 */}
      <SectionContainer className="bg-teal-light">
        <SectionHeadingCenter>{missionSection.heading}</SectionHeadingCenter>
        <div className="text-center text-md lg:px-8">
          <p className="my-2 font-semibold text-teal-dark">
            {missionSection.description.main}
          </p>
          <p className="font-light italic">{missionSection.description.body}</p>
        </div>
      </SectionContainer>

      {/* Section 4 */}
      <SectionContainer className="bg-gold-light">
        <SectionHeadingCenter>{teamSection.heading}</SectionHeadingCenter>
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {teamSection.body.map((member) => (
            <div
              key={member.name}
              className="text-center p-3 bg-neutral-offwhite rounded-lg shadow-md"
            >
              <img
                src={member.image}
                alt={member.name}
                className="mx-auto rounded-full border-4 border-rose-dark h-32 w-32 object-cover"
              />
              <h3 className="mt-4 text-lg font-bold font-display">
                {member.name}
              </h3>
              <p className="text-sm">{member.description}</p>
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* Section 5 */}
      <SectionContainer className="bg-rose-md" ref={impactRef}>
        <SectionHeadingCenter>{impactSection.heading}</SectionHeadingCenter>
        <div className="grid md:grid-cols-3 gap-6 mt-6 text-center text-white">
          <div>
            <h3 className="text-3xl font-bold">
              {hasAnimated ? (
                <CountUp end={impactSection.adopted} duration={2} />
              ) : (
                "0"
              )}
              +
            </h3>
            <p>{impactSection.description.adoptedDesc}</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold">
              {hasAnimated ? (
                <CountUp end={impactSection.animalsCared} duration={2} />
              ) : (
                "0"
              )}
              +
            </h3>
            <p>{impactSection.description.animalsCaredDesc}</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold">
              {hasAnimated ? (
                <CountUp end={impactSection.volunteers} duration={2} />
              ) : (
                "0"
              )}
              +
            </h3>
            <p>{impactSection.description.volunteersDesc}</p>
          </div>
        </div>
      </SectionContainer>

      {/* Section 6 */}
      <SectionContainer className="bg-teal-md">
        <SectionHeading>{testimonials.heading}</SectionHeading>
        <div className="grid md:grid-cols-2 gap-4 items-stretch mb-4">
          {testimonials.body.map((t) => (
            <article
              key={t.name}
              className="lg:flex bg-teal-light rounded-md m-5 p-10 h-full items-center"
            >
              <div className="lg:w-1/3 p-3 flex-shrink-0 text-center">
                <img
                  src={t.image}
                  alt={t.name}
                  className="mx-auto rounded-full w-40 h-40 object-cover"
                />
              </div>

              <div className="lg:w-2/3 lg:pl-4">
                <h3 className="lg:text-2xl text-xl font-display text-black mb-2">
                  {t.name}
                </h3>
                <blockquote className="italic font-light text-justify">
                  {t.description}
                </blockquote>
              </div>
            </article>
          ))}
        </div>
      </SectionContainer>

      {/* Section 7 */}
      <SectionContainer className="bg-gold-light">
        <SectionHeadingCenter>
          {joinMissionSection.heading}
        </SectionHeadingCenter>
        <div className="text-center">
          <p className="mt-4">{joinMissionSection.description}</p>
          <div className="flex items-center justify-center gap-2">
            <ButtonElement
              to="/adopt"
              className="bg-rose-dark hover:bg-gold-dark"
            >
              {joinMissionSection.button1}
            </ButtonElement>
            <ButtonElement
              to="/volunteerinfo"
              className="bg-teal-dark hover:bg-gold-dark"
            >
              {joinMissionSection.button2}
            </ButtonElement>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

export default About;
