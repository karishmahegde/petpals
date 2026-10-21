// Shared custom commands for e2e specs.

export interface TestAdopter {
  name: string;
  email: string;
  password: string;
}

const uniqueEmail = () =>
  `cy${Date.now()}${Math.floor(Math.random() * 1000000)}@ex.com`;

// Registers a fresh throwaway adopter straight against the API (POST
// /auth/register) — no UI involved. Specs use this for setup so they're
// self-contained and never depend on pre-seeded fixture accounts. The new
// account is recorded for the clean-up after each spec (support/e2e.ts). A
// new sign-up's email is unverified, like a real one.
Cypress.Commands.add("registerTestAdopter", (name = "Cypress Test Adopter") => {
  const adopter: TestAdopter = {
    name,
    email: uniqueEmail(),
    password: "Secret123!",
  };

  return cy
    .request("POST", "/api/v1/auth/register", {
      name: adopter.name,
      email: adopter.email,
      password: adopter.password,
      role: "adopter",
    })
    .then((res) => cy.task("db:trackUser", res.body.data.userID))
    .then(() => adopter);
});

// Signs in through the real login form and waits until it has left /login.
Cypress.Commands.add("loginThroughForm", (email: string, password: string) => {
  cy.get("#email").type(email);
  cy.get("#password").type(password);
  cy.get('form button[type="submit"]').click();
  cy.location("pathname", { timeout: 10000 }).should("not.eq", "/login");
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      registerTestAdopter(name?: string): Chainable<TestAdopter>;
      loginThroughForm(email: string, password: string): Chainable<void>;
    }
  }
}
