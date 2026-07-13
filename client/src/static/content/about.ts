import ourStoryImg from "../assets/images/about/ourStoryImg.jpg";
import testimonials1 from "../assets/images/about/testimonials/testimonials1.png";
import testimonials2 from "../assets/images/about/testimonials/testimonials2.png";
import testimonials3 from "../assets/images/about/testimonials/testimonials3.png";
import testimonials4 from "../assets/images/about/testimonials/testimonials4.png";
import team1 from "../assets/images/about/team/karishma.png";
import team2 from "../assets/images/about/team/claude.png";

export interface AboutContent {
  believeSection: { heading: string; description: string; button: string };
  ourStorySection: { heading: string; description: string; image: string };
  missionSection: {
    heading: string;
    description: { main: string; body: string };
  };
  teamSection: { heading: string; body: TeamCard[] };
  impactSection: {
    heading: string;
    adopted: number;
    animalsCared: number;
    volunteers: number;
    description: {
      adoptedDesc: string;
      animalsCaredDesc: string;
      volunteersDesc: string;
    };
  };
  testimonials: { heading: string; body: Testimonials[] };
  joinMissionSection: {
    heading: string;
    description: string;
    button1: string;
    button2: string;
  };
}

export interface Testimonials {
  name: string;
  description: string;
  image: string;
}

export interface TeamCard {
  name: string;
  description: string;
  image: string;
}

export const aboutContent: AboutContent = {
  believeSection: {
    heading: "We Believe 🐶",
    description:
      "Every pet deserves a loving home. ❤️ We're here to make it happen! 💪🏻",
    button: "Adopt a Pet ✨",
  },
  ourStorySection: {
    heading: "Our Story 🐹",
    description:
      "Founded in 2024 in Athens, GA, PetPals began as a small shelter with a big dream: 💫 to ensure every animal has a second chance at happiness. Today, we’ve grown into a community of passionate animal lovers across 10 states. ❤️",
    image: ourStoryImg,
  },
  missionSection: {
    heading: "Our Mission 🎯",
    description: {
      main: "At PetPals, we connect animals with loving homes 🏡 while supporting communities through volunteering and education.",
      body: "Every adoption starts with a real match, not just a listing and our responsibility doesn't end there. We continue to support adopters and pets through health coverage that travel with each animal across our shelter network. We believe a stronger community around adoption means fewer animals left behind.",
    },
  },
  teamSection: {
    heading: "Meet Our Team 🙌🏻",
    body: [
      {
        name: "Karishma",
        description: "Founder | Software Architect",
        image: team1,
      },
      {
        name: "Claude A",
        description: "Development Assistant",
        image: team2,
      },
    ],
  },
  impactSection: {
    heading: "Our Impact 🌟",
    adopted: 1200,
    animalsCared: 10000,
    volunteers: 300,
    description: {
      adoptedDesc: "pets adopted",
      animalsCaredDesc: "animals cared for",
      volunteersDesc: "volunteers",
    },
  },
  testimonials: {
    heading: "Testimonials",
    body: [
      {
        name: "Emily Johnson",
        description:
          "“Adopting Mischief was the best decision our family ever made. He's brought so much joy and love into our home. The staff at PetPals was so helpful, making the entire process seamless and stress-free. We are forever grateful!”",
        image: testimonials1,
      },
      {
        name: "Michael Brown",
        description:
          "“I was hesitant about adopting a senior bird, but Chicken has been a blessing. The detailed resources from PetPals prepared me for everything I needed to know. Buddy is the most loving, energetic companion I could ask for!”",
        image: testimonials2,
      },
      {
        name: "Daniel Miller",
        description:
          "“My experience with PetPals has been nothing short of amazing. Adopting Cookie has taught me so much about unconditional love. The staff even followed up to ensure Bella was settling in well. Highly recommend!”",
        image: testimonials3,
      },
      {
        name: "Sophia Williams",
        description:
          "“I was initially unsure about adoption, but seeing PetPals' dedication to their animals reassured me. Luna, my dove, has turned my house into a home. The team's support was incredible throughout the process!”",
        image: testimonials4,
      },
    ],
  },
  joinMissionSection: {
    heading: "Join Our Mission 🦜",
    description:
      "Ready to make a difference? Start your journey with PetPals today and get involved.",
    button1: "Adopt 🐱",
    button2: "Volunteer 🙌🏻",
  },
};
