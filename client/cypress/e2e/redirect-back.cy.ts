// Redirect-back flow: an unauthenticated visit to a protected route sends the
// browser to /login carrying the attempted destination, and logging in lands
// back there — not on the role-dashboard default. Exercises ProtectedRoute
// (logic/route/ProtectedRoute.tsx) and Login's resolveDestination
// (pages/public/auth/Login.tsx) together, end to end, in a real browser.
describe("Post-login redirect-back flow", () => {
  it("sends an unauthenticated visit to a protected route through /login, then back to that route after login", () => {
    cy.registerTestAdopter().then((adopter) => {
      // No session exists — visiting a protected page redirects to /login
      // with the attempted destination as ?redirect=.
      cy.visit("/adopter/profile");
      cy.location("pathname").should("eq", "/login");
      cy.location("search").should("eq", "?redirect=%2Fadopter%2Fprofile");

      cy.get("#email").type(adopter.email);
      cy.get("#password").type(adopter.password);
      cy.get('form button[type="submit"]').click();

      // Lands back on the originally-requested page, not /adopter (the
      // role-dashboard default) — the actual point of this flow.
      cy.location("pathname", { timeout: 10000 }).should("eq", "/adopter/profile");
    });
  });
});
