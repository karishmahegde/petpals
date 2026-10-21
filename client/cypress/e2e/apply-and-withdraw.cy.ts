// The core adoption path, in a real browser. (1) From the public catalog to
// the payment hand-off: browse /adopt, open the pet's details, Adopt, log in
// on the way, fill in the application and Continue to Payment — which leaves
// for Stripe Checkout. Stripe's own page is out of reach, so the spec stops
// at that hand-off: the request to checkout.stripe.com is answered with a
// stub instead of the real page. (2) Withdrawing: a paid application,
// recorded the way the Stripe webhook does it, shows on the dashboard and
// can be withdrawn there.
// Both adopters have finished onboarding and verified their email — the
// gates in front of applying (covered by email-verification-gate.cy.ts).
interface TestPet {
  petID: number;
  petName: string;
  shelterID: number;
  speciesID: number;
}

describe("Applying to adopt and withdrawing", () => {
  let pet: TestPet;

  before(() => {
    cy.task<TestPet>("db:availablePet").then((created) => {
      pet = created;
    });
  });

  it("browses to a pet, applies after logging in and is handed off to Stripe Checkout", () => {
    cy.registerTestAdopter("Cypress Applying Adopter").then((adopter) => {
      cy.task("db:completeOnboarding", adopter.email);
      cy.task("db:verifyEmail", adopter.email);

      // The test pet's species is its own, so this catalog shows only it.
      cy.visit(`/adopt?speciesID=${pet.speciesID}`);
      cy.contains(pet.petName).should("be.visible");
      cy.contains("button", "Know More").click();

      // Signed out, Adopt goes to the login page and back to the application.
      cy.contains("button", "Adopt or Foster").click();
      cy.location("pathname").should("eq", "/login");
      cy.loginThroughForm(adopter.email, adopter.password);
      cy.location("pathname").should("eq", `/adopt/apply/${pet.petID}`);
      cy.contains("h1", "Adoption Application").should("be.visible");
      cy.contains(pet.petName).should("be.visible");

      // Stripe's page itself isn't loaded — the stub stands in for it.
      cy.intercept("POST", "/api/v1/adoption-applications").as("checkout");
      cy.intercept("GET", "https://checkout.stripe.com/**", {
        statusCode: 200,
        headers: { "content-type": "text/html" },
        body: "<html><body>Stripe Checkout (stubbed)</body></html>",
      }).as("stripe");

      cy.contains("button", "Continue to Payment").should("be.disabled");
      cy.contains("button", /^Adopt$/).click();
      cy.get("textarea").type("We have a big garden and plenty of time.");
      cy.contains("button", "Continue to Payment").should("be.enabled").click();

      // The server made a real Stripe test-mode Checkout Session for the $15
      // fee, and the browser left for it.
      cy.wait("@checkout").then(({ response }) => {
        expect(response?.statusCode).to.eq(201);
        expect(response?.body.data.checkoutUrl).to.match(/^https:\/\/checkout\.stripe\.com\//);
      });
      cy.wait("@stripe")
        .its("request.url")
        .should("match", /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/);
    });
  });

  it("shows a paid application on the dashboard and withdraws it", () => {
    cy.registerTestAdopter("Cypress Withdrawing Adopter").then((adopter) => {
      cy.task("db:completeOnboarding", adopter.email);
      cy.task("db:verifyEmail", adopter.email);

      // What Stripe sends once the fee is paid — the webhook creates the
      // Pending application.
      cy.task<{ payload: string; signature: string }>("stripe:paidApplicationEvent", {
        adopterID: adopter.userID,
        petID: pet.petID,
        shelterID: pet.shelterID,
      }).then(({ payload, signature }) => {
        cy.request({
          method: "POST",
          url: "/api/v1/webhooks/stripe",
          headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
          body: payload,
        })
          .its("status")
          .should("eq", 200);
      });

      cy.visit("/adopter/applications");
      cy.loginThroughForm(adopter.email, adopter.password);
      cy.location("pathname").should("eq", "/adopter/applications");

      cy.contains("li", pet.petName).as("row");
      cy.get("@row").should("contain", "Under Consideration");
      cy.get("@row").contains("button", "Withdraw").click();

      // The page keeps other dialogs mounted (hidden), so the confirm modal
      // is found by its title.
      cy.contains('[role="dialog"]', "Withdraw application?").within(() => {
        cy.contains(pet.petName).should("be.visible");
        cy.contains("button", "Withdraw").click();
      });

      cy.contains("Application withdrawn").should("be.visible");
      cy.contains("Withdraw application?").should("not.exist");
      cy.contains("li", pet.petName).within(() => {
        cy.contains("Withdrawn").should("be.visible");
        cy.contains("button", "Withdraw").should("not.exist");
      });
    });
  });
});
