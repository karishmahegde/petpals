// The email-verification soft gate on the apply page, in a real browser: an
// adopter who hasn't verified their email sees "Verify your email first"
// instead of Continue to Payment, and a verified one gets the payment button.
// Both have finished onboarding — applying is closed until they have.
// Rendered states only — the real verification link only exists in an email
// (the redeeming itself is covered by server/src/tests/integration/auth/
// sprint9Journeys.test.js).
describe("Email-verification gate on applying to adopt", () => {
  let petID: number;

  before(() => {
    cy.task<{ petID: number }>("db:availablePet").then((pet) => {
      petID = pet.petID;
    });
  });

  it("an unverified adopter sees the notice, not the payment button", () => {
    cy.registerTestAdopter("Cypress Unverified Adopter").then((adopter) => {
      cy.task("db:completeOnboarding", adopter.email);

      cy.visit(`/adopt/apply/${petID}`);
      cy.location("pathname").should("eq", "/login");
      cy.loginThroughForm(adopter.email, adopter.password);

      cy.location("pathname").should("eq", `/adopt/apply/${petID}`);
      cy.contains("Verify your email first").should("be.visible");
      cy.contains("You'll need a verified email address to apply to adopt").should("be.visible");
      cy.contains("button", "Resend verification email").should("be.enabled");
      cy.contains("button", "Continue to Payment").should("not.exist");
    });
  });

  it("a verified adopter gets the payment button, not the notice", () => {
    cy.registerTestAdopter("Cypress Verified Adopter").then((adopter) => {
      cy.task("db:completeOnboarding", adopter.email);
      cy.task("db:verifyEmail", adopter.email);

      cy.visit(`/adopt/apply/${petID}`);
      cy.loginThroughForm(adopter.email, adopter.password);

      cy.location("pathname").should("eq", `/adopt/apply/${petID}`);
      cy.contains("button", "Continue to Payment").should("be.visible");
      cy.contains("Verify your email first").should("not.exist");
    });
  });
});
