// Loaded before every e2e spec. Pulls in the custom commands below so specs
// can just call cy.registerTestAdopter() etc.
import "./commands";

// After each spec file, remove everything it created — accounts, the test
// pet and its shelter — even if a test failed (cypress/dbTasks.cjs).
after(() => {
  cy.task("db:cleanUp");
});
