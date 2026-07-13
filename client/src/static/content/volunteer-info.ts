import volunteerInfoImg from "../assets/images/volunteerInfo/volunteerInfo.png";

export interface VolunteerSteps {
  number: string;
  title: string;
  description: string;
}

export interface VolunteerInfoContent {
  heroSection: { heading: string; description: string; image: string };
  stepsSection: { heading: string; steps: VolunteerSteps[] };
  joinSection: { heading: string; description: string; button: string };
}

export const volunteerContent: VolunteerInfoContent = {
  heroSection: {
    heading: "Become a Volunteer at PetPals ✨🐶",
    description:
      "Volunteering at PetPals is an enriching experience that allows you to make a real difference in the lives of our animals. Whether you’re helping shy cats find their confidence 🥹, walking energetic dogs, or assisting with shelter operations, every moment you spend makes a positive impact 💖. Join our community of compassionate individuals and be a part of something special!",
    image: volunteerInfoImg,
  },
  stepsSection: {
    heading: "How to Get Started? 📋",
    steps: [
      {
        number: "1",
        title: "Sign up 🧑🏻",
        description:
          "Create an account on our portal and provide basic details about yourself, and your availability. You don't need to have prior experience with pets, we will guide you!",
      },
      {
        number: "2",
        title: "Get Approved ✅",
        description:
          "Once our staff approves your application, visit your assigned shelter to receive onboarding material.",
      },
      {
        number: "1",
        title: "Start Volunteering 🐕",
        description:
          "You can contribute to various daily and weekly tasks, assigned based on your expertise by our staff and your availability. You can also be part of organizing shelter events!",
      },
    ],
  },
  joinSection: {
    heading: "Sign Up to Volunteer",
    description:
      "Join our community of volunteers and make a difference in the lives of animals. 💫 Signing up is quick and easy!",
    button: "Sign Up",
  },
};
