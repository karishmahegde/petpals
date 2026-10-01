// Every statement here should match what the app actually does — update the
// matching section (and `lastUpdated`) whenever a feature starts collecting,
// sharing or keeping data differently.

// Shapes shared with terms-of-service.ts.
export interface LegalList {
  intro?: string;
  items: string[];
}

export interface LegalSection {
  // Anchor for the contents list (`/<page>#<id>`).
  id: string;
  heading: string;
  // Rendered in order: a string is a paragraph, an object a bulleted list.
  blocks: (string | LegalList)[];
}

export interface LegalHeroContent {
  heading: string;
  description: string;
  lastUpdated: string;
}

export interface LegalContactContent {
  heading: string;
  description: string;
  email: string;
}

export type GlanceIcon = "noSale" | "idLock" | "payments" | "control";

export interface GlanceItem {
  icon: GlanceIcon;
  title: string;
  description: string;
}

export interface PrivacyPolicyContent {
  heroSection: LegalHeroContent;
  glanceSection: { heading: string; items: GlanceItem[] };
  sections: LegalSection[];
  contactSection: LegalContactContent;
}

export const privacyPolicyContent: PrivacyPolicyContent = {
  heroSection: {
    heading: "Privacy Policy",
    description:
      "Finding a pet a home means sharing a little about yours. This page explains what we collect, why we need it, who sees it, and how you stay in control.",
    lastUpdated: "October 1, 2026",
  },
  glanceSection: {
    heading: "At a Glance",
    items: [
      {
        icon: "noSale",
        title: "We never sell your data",
        description:
          "Your details are used to run adoptions, visits and volunteering. Nothing else.",
      },
      {
        icon: "idLock",
        title: "Your ID stays private",
        description:
          "Government ID documents are kept in private storage that only verification staff can open.",
      },
      {
        icon: "payments",
        title: "Stripe handles payments",
        description:
          "Card details go straight to Stripe. We never see or store your card number.",
      },
      {
        icon: "control",
        title: "You're in control",
        description:
          "Update your profile anytime, or deactivate or delete your account from your dashboard.",
      },
    ],
  },
  sections: [
    {
      id: "who-we-are",
      heading: "Who We Are",
      blocks: [
        'PetPals is an adoption platform that brings together the animal listings, applications and medical records of every shelter in our network. When this policy says "we" or "us", it means PetPals and the shelters that use it to care for animals and review applications.',
      ],
    },
    {
      id: "information-we-collect",
      heading: "Information We Collect",
      blocks: [
        "We only ask for what we need to match pets with the right homes and keep our shelters running.",
        {
          intro: "When you create an account:",
          items: [
            "Your email address and a password, which we store only in scrambled (hashed) form",
            "Your name, date of birth, sex, phone number and home address",
          ],
        },
        {
          intro: "If you're adopting, your adoption profile:",
          items: [
            "Your home: housing type, whether you own or rent, your landlord's contact details if you rent, and whether you have a yard",
            "Your household: how many people and children live with you, and any pets you already have",
            "Your lifestyle: employment status, activity level and experience with pets",
            "Your preferences: the breed, age and size you're looking for, and whether you're open to pets with special needs",
          ],
        },
        {
          intro: "To verify your identity:",
          items: [
            "A photo or scan of a government-issued ID, along with its type and number",
          ],
        },
        {
          intro: "As you use PetPals:",
          items: [
            "The pets you favourite, the applications you submit and the shelter visits you book",
            "Payment records for application fees, such as the amount paid and Stripe's reference for the payment",
            "Your zip code or current location when you search for nearby shelters. It's used for that search only and isn't saved to your account",
          ],
        },
        {
          intro: "If you work or volunteer with us:",
          items: [
            "Your shelter, role, start date and schedule, alongside the account and ID details above",
          ],
        },
      ],
    },
    {
      id: "how-we-use-it",
      heading: "How We Use Your Information",
      blocks: [
        {
          items: [
            "To create and secure your account and keep you signed in",
            "To let shelter staff review your application and decide whether a pet is a good fit for your home",
            "To schedule visits and show you vet appointments for pets you've been approved to adopt",
            "To verify the identity of adopters, staff and volunteers",
            "To process application fees and keep a record of payments",
            "To show you shelters and pets near you when you ask us to",
            "To answer your questions when you contact support",
          ],
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      heading: "Who We Share It With",
      blocks: [
        "We never sell your personal information or share it for advertising. We only share it with the people and services that need it to run PetPals:",
        {
          items: [
            "Shelter staff, who see your profile and application when you apply for one of their pets",
            "Stripe, which processes application fees",
            "Supabase, which hosts our database and file storage",
            "Vercel and Railway, which host the PetPals website and servers",
          ],
        },
      ],
    },
    {
      id: "cookies",
      heading: "Cookies & Browser Storage",
      blocks: [
        "We use a single cookie, and only to keep you signed in. It lasts up to 7 days, can't be read by scripts on the page, and is removed when you log out.",
        "While you fill in an adoption application, your browser keeps a draft for the current tab so a refresh doesn't wipe your answers. It's cleared once you close the tab.",
        "We don't use advertising or tracking cookies.",
      ],
    },
    {
      id: "how-we-protect-it",
      heading: "How We Protect It",
      blocks: [
        {
          items: [
            "Passwords are hashed before they're stored, so not even our team can read them",
            "Government ID documents live in private storage, and only part of your ID number is ever shown back to you",
            "Every account can only see what its role needs: adopters see their own records, and staff see the applications for their shelter",
            "Sign-in sessions expire automatically and end the moment you log out",
          ],
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      heading: "How Long We Keep It",
      blocks: [
        "We keep your information for as long as your account is open. From your dashboard you can choose to:",
        {
          items: [
            "Deactivate your account, which signs you out and pauses your account while keeping your details in case you return",
            "Delete your account, which permanently erases your profile, ID document, favourites, visits and applications",
          ],
        },
      ],
    },
    {
      id: "your-choices",
      heading: "Your Choices",
      blocks: [
        {
          items: [
            "View and update your profile at any time from your dashboard",
            "Withdraw an application that's still under consideration or approved",
            "Turn off location access in your browser. You can always search by zip code instead",
            "Contact us for a copy of the information we hold about you",
          ],
        },
        "If you've adopted a pet through PetPals, you can't deactivate or delete your account yourself, because the shelter needs to be able to reach that pet's caretaker. Contact us and we'll help.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        "PetPals isn't intended for children under 13, and we don't knowingly collect their information. If you think a child has signed up, let us know and we'll remove the account.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to This Policy",
      blocks: [
        "If we change how we handle your information, we'll update this page and the date at the top. If a change is significant, we'll let you know before it takes effect.",
      ],
    },
  ],
  contactSection: {
    heading: "Questions About Your Privacy?",
    description:
      "If something here isn't clear, or you'd like a copy of your data, we're happy to help.",
    email: "support@petpals.com",
  },
};
