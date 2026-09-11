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
// self-contained and never depend on pre-seeded fixture accounts. The
// generated email is unique per call, so nothing needs cleaning up between
// runs (mirrors the uniqueEmail() convention in server/src/tests/integration).
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
    .then(() => adopter);
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      registerTestAdopter(name?: string): Chainable<TestAdopter>;
    }
  }
}
