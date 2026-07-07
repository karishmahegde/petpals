import { Link } from "react-router-dom";
import { adoptContent } from "../../../static/content/adopt";
import adoptImage from "../../../static/assets/images/adopt/adopt.png";
import PetCatalog from "./PetCatalog";

const { hero, signupCta, steps } = adoptContent;

const Adopt = () => {
  return (
    <div className="font-body">
      {/* Hero */}
      <section className="grid gap-4 p-14 bg-teal md:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="mb-5 text-3xl font-bold text-black lg:text-4xl">
            {hero.heading}
          </h1>
          <p className="text-justify font-light">{hero.body}</p>

          <a
            href="#pets"
            className="mt-6 inline-block rounded-md bg-teal-dark px-6 py-2 text-white transition hover:bg-gold-md hover:text-black w-fit"
          >
            Adopt a Pet
          </a>
        </div>

        <div className="flex items-center justify-center text-center md:p-5">
          <div className="flex w-full items-center justify-center text-neutral-gray">
            <img src={adoptImage} alt="Adopt a Pet" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* How to Adopt */}
      <section className="bg-gold-light p-14">
        <div className="flex flex-col justify-center">
          <h2 className="m-8 mb-4 text-center text-3xl font-bold text-black lg:text-4xl">
            How to Adopt? 🐹
          </h2>
          <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-10">
            {steps.map((step) => (
              <div key={step.number} className="mb-3 lg:mb-6">
                <div className="flex h-full flex-row items-start justify-between rounded-lg bg-gold-md p-3 text-white lg:p-6">
                  <div className="flex items-center space-x-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 font-bold text-white">
                      {step.number}
                    </span>
                  </div>
                  <div className="mx-2">
                    <span className="text-xl font-bold">{step.title}</span>
                    <p className="mt-1 text-sm text-neutral-charcoal lg:mt-4">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA to Sign Up */}
      <section className="bg-rose-light p-14 text-center">
        <h2 className="m-8 mb-4 text-3xl font-bold text-black lg:text-4xl">
          {signupCta.heading}
        </h2>
        <p className="text-md font-light">{signupCta.body}</p>
        <Link
          to="/login"
          className="my-3 inline-block rounded-md bg-gold-md px-6 py-2 font-bold text-white transition hover:bg-teal-dark"
        >
          Sign Up
        </Link>
      </section>

      {/* Search + Catalog */}
      <PetCatalog />
    </div>
  );
};

export default Adopt;
