import carousel1 from "../assets/images/home/Carousel1.png";
import carousel2 from "../assets/images/home/Carousel2.png";
import carousel3 from "../assets/images/home/Carousel3.png";
import featVolunteerImg from "../assets/images/home/featVolunteerImg.png";
import adoptImage from "../assets/images/adopt/adopt.png";

// The carousel images are 2452×1000 banners with the heading and text drawn
// in. Desktop shows the whole banner; phones show `crop` (the picture alone,
// as fractions of the image) above `heading` and `body` as real text, on the
// banner's own flat `background`.
export interface Slide {
  src: string;
  heading: string;
  body: string;
  pictureAlt: string;
  background: string;
  crop: { left: number; right: number; top: number; bottom: number };
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
  {
    src: carousel1,
    heading: "Get your family a new member.",
    body: "Open your hearts and homes to animals in need and they will be thankful for the rest of their lives.",
    pictureAlt: "A tabby kitten",
    background: "#fffaf9",
    crop: { left: 450 / 2452, right: 1000 / 2452, top: 0.13, bottom: 0.86 },
  },
  {
    src: carousel2,
    heading: "Adopt, don’t shop.",
    body: "Pets are not products. Shelter animals need homes more than backyard breeders need your money.",
    pictureAlt: "A curly-haired puppy in a cardboard box",
    background: "#f5fbfd",
    crop: { left: 1370 / 2452, right: 1950 / 2452, top: 0.13, bottom: 0.86 },
  },
  {
    src: carousel3,
    heading: "Become a volunteer.",
    body: "Sign up today and experience unforgettable moments while giving to animals in need.",
    pictureAlt: "A smiling volunteer hugging a beagle",
    background: "#f6ecdb",
    crop: { left: 410 / 2452, right: 1110 / 2452, top: 0.12, bottom: 0.86 },
  },
];
