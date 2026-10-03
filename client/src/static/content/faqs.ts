import faqStartImg from "../assets/images/faqs/faqStart.png";
import faqEndImg from "../assets/images/faqs/faqEnd.png";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  heading: string;
  items: FaqItem[];
}

// A null `src` shows a labelled placeholder instead, using `alt` as the
// hint for what the image should be.
export interface FaqImage {
  src: string | null;
  alt: string;
}

export interface FaqsContent {
  heroSection: { heading: string; description: string; image: FaqImage };
  categories: FaqCategory[];
  contactSection: {
    heading: string;
    description: string;
    email: string;
    phone: string;
    image: FaqImage;
  };
}

export const faqsContent: FaqsContent = {
  heroSection: {
    heading: "Frequently Asked Questions",
    description:
      "Curious about adopting, visiting, or volunteering? You're in the right place. We've fetched answers to the questions we hear most, so you can spend less time wondering and more time finding your new best friend.",
    image: {
      src: faqStartImg,
      alt: "A curious pug tilting its head, as if asking a question",
    },
  },
  categories: [
    {
      heading: "Finding Your Pet",
      items: [
        {
          question: "Where do the pets on PetPals come from?",
          answer:
            "Every pet listed lives at one of the shelters in our network. Instead of hopping between shelter websites, you can browse every branch in one place.",
        },
        {
          question: "How do I find pets near me?",
          answer:
            "On the Adopt page, enter your zip code or share your current location, pick a search radius, and select Find Nearby Shelters. We'll show pets from the shelters within that distance.",
        },
        {
          question: "Can I narrow down my search?",
          answer:
            "Of course! Filter by species, breed, size, and age, or choose specific shelters. Mix and match until the list feels just right.",
        },
        {
          question: "Can I save pets I like?",
          answer:
            "Yes. Once you're signed in, tap the heart on any pet to add them to your Favorites. They'll wait for you in your dashboard while you think it over.",
        },
      ],
    },
    {
      heading: "Adopting",
      items: [
        {
          question: "How does the adoption process work?",
          answer:
            "Create an adopter account, complete your profile, and select Adopt on the pet who stole your heart. Submit your application with the application fee, and the shelter team will review it. You can follow its progress from your dashboard every step of the way.",
        },
        {
          question: "Is there an application fee?",
          answer:
            "Yes, there is a one-time $15 fee per application, paid securely online when you submit. It helps cover the time our shelter teams spend on each review. The fee is non-refundable, even if you later withdraw.",
        },
        {
          question: "Why do you need so many details about my home?",
          answer:
            "Your household, lifestyle, and preferences help our staff make sure each pet lands in a home where they'll truly thrive. Think of it as making the perfect match, not a test you can fail.",
        },
        {
          question: "What do the application statuses mean?",
          answer:
            "Under Consideration means the shelter is reviewing your application. Approved means you're one step away from bringing your new pal home. Declined means the shelter went another way this time. Withdrawn means you cancelled the application yourself.",
        },
        {
          question: "Can I apply for more than one pet?",
          answer:
            "Yes, you can have applications open for different pets at the same time. You can only have one active application for each pet, though.",
        },
        {
          question: "Can I withdraw my application?",
          answer:
            "Yes, as long as it's Under Consideration or Approved. Just open it from your dashboard and select Withdraw. The application fee isn't refunded, but you're always welcome to apply again later.",
        },
        {
          question:
            "What happens if another adopter is approved for the same pet?",
          answer:
            "Each pet can only go home with one family, so once an application is approved, any others for that pet are declined. We know that can be ruff news. There are plenty of other wonderful pets waiting to meet you!",
        },
      ],
    },
    {
      heading: "Visits",
      items: [
        {
          question: "Can I meet a pet before applying?",
          answer:
            "We'd love that! Schedule a meet-and-greet from your dashboard's Visits page, or straight from a pet's profile. Nothing beats a first sniff in person.",
        },
        {
          question: "What if I can't make my visit?",
          answer:
            "Plans change, and that's okay. You can cancel any upcoming visit from your dashboard, then book a new time whenever suits you.",
        },
      ],
    },
    {
      heading: "Health & Care",
      items: [
        {
          question: "How do I know a pet is healthy?",
          answer:
            "Every pet has a health passport that holds their vaccination and medical records. It travels with them if they move between shelters in our network, so no part of their history gets lost along the way.",
        },
        {
          question: "Can I see my pet's records after adoption?",
          answer:
            "Yes. Your adopted pets appear in your dashboard, along with their vaccination history, so you'll always know when the next booster is due.",
        },
      ],
    },
    {
      heading: "Your Account",
      items: [
        {
          question: "Why do you ask for a government ID?",
          answer:
            "It helps our shelters confirm who they're placing pets with and keeps every adoption safe. Your ID is stored privately and is only seen by the staff who verify it.",
        },
        {
          question: "Can I close my account?",
          answer:
            "Yes, you can close your account at any time from the Profile page in your dashboard. We'll be sad to see you go, but we promise not to paw at the door.",
        },
      ],
    },
    {
      heading: "Volunteering",
      items: [
        {
          question: "How do I become a volunteer?",
          answer:
            "Sign up as a volunteer and choose the shelter you'd like to help. Once the staff there approve you, you'll receive your onboarding details and can start lending a helping hand (or paw).",
        },
        {
          question: "Do I need experience with animals?",
          answer:
            "Not at all. Our staff will show you the ropes, and tasks are assigned based on your skills and availability. Enthusiasm is the only requirement.",
        },
        {
          question: "What will I be doing?",
          answer:
            "Anything from dog walks and feeding time to helping out at shelter events. Every task, big or small, makes a shelter pet's day a little brighter.",
        },
      ],
    },
    {
      heading: "Events",
      items: [
        {
          question: "Where can I find upcoming events?",
          answer:
            "Head to the Events page to see what's happening across our shelters, from adoption days to community get-togethers. It's a great way to meet pets and fellow animal lovers.",
        },
      ],
    },
  ],
  contactSection: {
    heading: "Need More Help?",
    description:
      "If you couldn't find what you were looking for, our team is happy to help. Email or call us and we'll get back to you faster than a puppy hearing the treat bag.",
    email: "support@petpals.com",
    phone: "+1 (706) 342-8631",
    image: {
      src: faqEndImg,
      alt: "A shelter volunteer cuddling a calico cat",
    },
  },
};
