import carousel1 from "../assets/images/home/Carousel1.png";
import carousel2 from "../assets/images/home/Carousel2.png";
import carousel3 from "../assets/images/home/Carousel3.png";
import featVolunteerImg from "../assets/images/home/featVolunteerImg.png";
import adoptImage from "../assets/images/adopt/adopt.png";

export interface Slide {
  src: string;
  alt: string;
}

export interface AdoptStep {
  number: string;
  title: string;
  description: string;
}

export interface AdoptContent {
  heading: string;
  steps: AdoptStep[];
  image: string;
  terms: string;
}

export interface FeatVolunteer {
  heading: string;
  content: { name: string; about: string };
  image: string;
}

export interface HomeStatic {
  adoptContent: AdoptContent;
  featVolunteer: FeatVolunteer;
}

export const homeStatic: HomeStatic = {
  adoptContent: {
    heading: "Adopt in 3 easy steps!*",
    steps: [
      {
        number: "1",
        title: "Find Your Match",
        description:
          "Browse through our selection of adorable cats waiting for their forever homes. Filter your search by age, breed, personality, and more to find the purrfect feline companion that fits your lifestyle.",
      },
      {
        number: "2",
        title: "Meet & Greet",
        description:
          "Schedule a visit to our shelter to meet the cats you're interested in. Spend some quality time getting to know them. Our team will be on hand to answer questions and guide you through the process.",
      },
      {
        number: "3",
        title: "Finalize Adoption and Furever Home",
        description:
          "Once you've found the purrfect match, complete our adoption application and screening process. If everything checks out, you’ll be ready to bring your new furry friend home!",
      },
    ],
    image: adoptImage,
    terms: "*Terms & Conditions Apply",
  },
  featVolunteer: {
    heading: "Meet our featured volunteer",
    content: {
      name: "Katherine",
      about:
        "“Volunteering at PetPals has been incredibly rewarding. Interacting with these amazing animals brings me joy every week. From socializing with shy kittens to playing with energetic puppies, I feel like I'm making a real difference. The staff's passion and dedication create a caring community I'm proud to be part of. I'm grateful for the opportunity to contribute to the well-being of these beautiful souls and look forward to continuing my volunteer work here.”",
    },
    image: featVolunteerImg,
  },
};

export const carouselSlides: Slide[] = [
  { src: carousel1, alt: "Happy cat being adopted" },
  { src: carousel2, alt: "Volunteer walking a dog" },
  { src: carousel3, alt: "Family with their new pet" },
];
