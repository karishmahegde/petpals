import ButtonElement from "../../../components/ui/ButtonElement";
import SectionContainer from "../../../components/ui/SectionContainer";
import SectionHeadingCenter from "../../../components/ui/SectionHeadingCenter";
import { volunteerContent } from "../../../static/content/volunteer-info";

const VolunteerInfo = () => {
  const { heroSection, stepsSection, joinSection } = volunteerContent;

  return (
    <div className="font-body">
      {/* Section 1 */}
      <SectionContainer className="bg-teal-light">
        <SectionHeadingCenter>{heroSection.heading}</SectionHeadingCenter>
        <div className="flex flex-col mx-5 lg:flex-row gap-8 justify-center items-center">
          {/* Photo */}
          <div className="w-40 sm:w-56 md:w-72 lg:w-1/3 flex justify-center items-center">
            <img
              src={heroSection.image}
              className="w-full h-auto"
              alt="Adopt a Pet"
            />
          </div>
          {/* Text */}
          <div className="w-full sm:px-10 sm:pb-10 lg:w-2/3 justify-center">
            <blockquote className="mt-2 italic text-justify font-light">
              {heroSection.description}
            </blockquote>
          </div>
        </div>
      </SectionContainer>

      {/* Section 2 */}
      <SectionContainer className="bg-gold-light">
        <SectionHeadingCenter>{stepsSection.heading}</SectionHeadingCenter>
        <div className="w-4/5 lg:w-3/5 mx-auto rounded-xl bg-gold-md p-6">
          {stepsSection.steps.map((step) => (
            <div className="mb-6" key={step.number}>
              <div className="flex items-start space-x-4 bg-neutral-offwhite rounded-lg p-5 m-1 lg:m-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 font-bold text-white">
                  {step.number}
                </span>
                <div>
                  <span className="block mb-2 text-lg lg:text-xl font-bold text-black">
                    {step.title}
                  </span>
                  <p className="text-sm text-gray-700">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* Section 3 */}
      <SectionContainer className="bg-rose">
        <SectionHeadingCenter>{joinSection.heading}</SectionHeadingCenter>
        <div className="text-center">
          <p className="text-md font-light">{joinSection.description}</p>
          <ButtonElement
            to="/adopt"
            className="bg-teal-dark hover:bg-gold-dark"
          >
            {joinSection.button}
          </ButtonElement>
        </div>
      </SectionContainer>
    </div>
  );
};

export default VolunteerInfo;
