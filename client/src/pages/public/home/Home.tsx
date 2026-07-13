import Carousel from "./sections/Carousel";
import FeaturedPets from "./sections/FeaturedPets";
import Searchbar from "./sections/Searchbar";
import { homeStatic } from "../../../static/content/home";
import SectionContainer from "../../../components/ui/SectionContainer";
import SectionHeading from "../../../components/ui/SectionHeading";

const { adoptContent, featVolunteer } = homeStatic;

const Home = () => {
  return (
    <div className="font-body">
      <Carousel />
      <FeaturedPets />
      <Searchbar />
      {/* Adopt Steps */}
      <SectionContainer className="bg-gold-light">
        <SectionHeading>{adoptContent.heading}</SectionHeading>
        <div className="md:flex gap-8 px-5 justify-center items-center mx-auto">
          <ol className="md:flex-1 w-full space-y-6 mb-6 lg:w-1/2">
            {adoptContent.steps.map((step) => (
              <li key={step.number} className="flex items-start gap-4 mb-6">
                {/* Number circle */}
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 font-bold text-white"
                >
                  {step.number}
                </span>

                {/* Text */}
                <div>
                  <h3 className="mb-2 text-xl font-bold text-black">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-700">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="md:flex-1 mx-auto w-80 lg:w-1/2 items-center justify-center">
            <div className="relative">
              <img
                src={adoptContent.image}
                alt="Adopt a Pet"
                className="w-full h-auto"
              />
              <p className="mt-2 text-right text-[0.5rem] italic lg:text-xs">
                *Terms &amp; Conditions Apply
              </p>
            </div>
          </div>
        </div>
      </SectionContainer>

      {/* Featured Volunteer */}
      <SectionContainer className="bg-teal-light">
        <SectionHeading>{featVolunteer.heading}</SectionHeading>
        <div className="flex flex-col md:flex-row gap-8 px-5 justify-center items-center mx-auto">
          {/* Photo */}
          <div className="w-72 lg:w-1/3 flex justify-center items-center">
            <img
              src={featVolunteer.image}
              alt="Adopt a Pet"
              className="w-full h-auto"
            />
          </div>
          {/* Text */}
          <div className="w-full sm:px-10 sm:pb-10 lg:w-2/3 justify-center">
            <h3 className="lg:text-3xl text-2xl font-display text-black">
              {featVolunteer.content.name}
            </h3>
            <blockquote className="mt-2 italic text-justify font-light">
              {featVolunteer.content.about}
            </blockquote>
          </div>
        </div>
      </SectionContainer>
    </div>
  );
};

export default Home;
