export interface AdoptStep {
  number: number;
  title: string;
  description: string;
}

export interface AdoptContent {
  hero: { heading: string; body: string };
  signupCta: { heading: string; body: string };
  steps: { heading: string; body: AdoptStep[] };
}

export const adoptContent: AdoptContent = {
  hero: {
    heading: "Adopt a Pet from PetPals ✨🦮",
    body: "Adopting a pet is a life-changing experience filled with joy, love, and companionship. At PetPals, we're dedicated to matching you with the perfect pet for your family and lifestyle. By adopting, you're not only giving a loving animal a home, but also opening up space for us to help more pets in need.",
  },
  signupCta: {
    heading: "Sign Up to Adopt",
    body: "Ready to bring a pet into your life? 🥰🌟 Create an account to start your adoption journey today!",
  },
  steps: {
    heading: "How to Adopt? 🐹",
    body: [
      {
        number: 1,
        title: "Browse Available Pets 🔎🐩",
        description:
          "Explore our database of pets looking for their forever homes. Use filters to find the perfect match based on species, breed, age, and more. You can get started below. 🤩",
      },
      {
        number: 2,
        title: "Apply for Adoption 📋",
        description:
          "Once you find a pet you're interested in, submit an online adoption application. This helps us understand your preferences and ensure the best match. 💕",
      },
      {
        number: 3,
        title: "Meet Your Pet 🤝🏻🐾",
        description:
          "Schedule a visit to meet the pet in person at our shelter or join a virtual meet-and-greet session. It's a great opportunity to interact with your potential new family member. 😍",
      },
      {
        number: 4,
        title: "Finalize the Adoption 🏅✅",
        description:
          "After the application is approved, complete the adoption process by signing the agreement and paying the adoption fee. Welcome your new furry friend home! 🏡",
      },
    ],
  },
};
