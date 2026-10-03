// Every rule here should match how the app actually behaves — update the
// matching section (and `lastUpdated`) whenever a flow, fee or limit changes.

import type {
  LegalContactContent,
  LegalHeroContent,
  LegalSection,
} from "./privacy-policy";

export interface TermsOfServiceContent {
  heroSection: LegalHeroContent;
  sections: LegalSection[];
  contactSection: LegalContactContent;
}

export const termsOfServiceContent: TermsOfServiceContent = {
  heroSection: {
    heading: "Terms of Service",
    description:
      "The ground rules for using PetPals, written to be read, not skimmed. They keep things fair for adopters, our shelters and, most of all, the animals in our care.",
    lastUpdated: "October 1, 2026",
  },
  sections: [
    {
      id: "accepting-these-terms",
      heading: "Accepting These Terms",
      blocks: [
        "By creating an account or using PetPals, you agree to these terms. If you don't agree, please don't use the site.",
        "How we handle your personal information is covered separately in our Privacy Policy.",
      ],
    },
    {
      id: "who-can-use-petpals",
      heading: "Who Can Use PetPals",
      blocks: [
        "Anyone can browse pets and shelters. To create an account and apply to adopt, you must be at least 18 years old.",
        "Staff, veterinarian and volunteer accounts are only activated once the shelter organisation has approved them.",
      ],
    },
    {
      id: "your-account",
      heading: "Your Account",
      blocks: [
        {
          items: [
            "Give us accurate, up-to-date information, and keep your profile current",
            "Keep your password private. You're responsible for everything done through your account",
            "Use one account per person, and only your own",
            "Let us know straight away if you think someone else has accessed your account",
          ],
        },
      ],
    },
    {
      id: "adopting",
      heading: "Adopting Through PetPals",
      blocks: [
        "Pet listings, including photos, ages and health details, are provided by the shelters in our network. They do their best to keep them accurate, but details can change as they get to know each animal.",
        {
          intro: "When you apply to adopt:",
          items: [
            "Submitting an application doesn't guarantee you'll be approved. The shelter caring for the pet makes the final decision",
            "You can only have one open application for the same pet at a time",
            "Each pet can only have one approved adopter. When an application is approved, any other applications still under consideration for that pet are declined",
            "You can withdraw your application while it's under consideration or approved, and you're welcome to apply again later",
          ],
        },
      ],
    },
    {
      id: "application-fees",
      heading: "Application Fees",
      blocks: [
        "Each adoption application has a one-time $15 fee, paid securely through Stripe when you submit it. The fee helps cover the time our shelter teams spend on every review.",
        "The fee is non-refundable, including when an application is withdrawn or declined. Applying again counts as a new application, with a new fee.",
      ],
    },
    {
      id: "visits",
      heading: "Shelter Visits",
      blocks: [
        "You can book visits to meet pets and cancel upcoming visits from your dashboard. If you can't make it, please cancel so the time can go to another adopter.",
      ],
    },
    {
      id: "identity-verification",
      heading: "Identity Verification",
      blocks: [
        "We may ask you to upload a government-issued ID before you can adopt, work or volunteer with us. The document must be genuine, current and your own.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable Use",
      blocks: [
        {
          intro: "When using PetPals, please don't:",
          items: [
            "Provide false information or pretend to be someone else",
            "Apply for a pet on someone else's behalf without telling the shelter",
            "Use other people's personal information for anything other than arranging an adoption",
            "Copy listings in bulk, or try to disrupt, overload or break into the site",
          ],
        },
      ],
    },
    {
      id: "closing-your-account",
      heading: "Closing Your Account",
      blocks: [
        "You can deactivate or permanently delete your account from your dashboard at any time. If you've adopted a pet through PetPals, contact us instead, as the shelter needs to be able to reach that pet's caretaker.",
        "We may suspend or close accounts that break these terms or put animals, adopters or shelter teams at risk.",
      ],
    },
    {
      id: "pets-and-responsibility",
      heading: "Pets & Responsibility",
      blocks: [
        "Shelters and their vets share each pet's health and behaviour history to the best of their knowledge, but animals are living beings and can't come with guarantees. Once an adoption is complete, you're responsible for your pet's care, wellbeing and behaviour.",
        "PetPals is provided as it is. While we work hard to keep it running smoothly, we can't promise it will always be available or error-free.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to These Terms",
      blocks: [
        "We may update these terms as PetPals grows. When we do, we'll change the date at the top of this page, and we'll let you know before any significant change takes effect.",
      ],
    },
  ],
  contactSection: {
    heading: "Questions About These Terms?",
    description:
      "If anything here is unclear, get in touch and we'll be happy to explain.",
    email: "support@petpals.com",
  },
};
