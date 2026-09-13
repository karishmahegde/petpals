import { defineConfig } from "cypress";

// Cypress drives the actual running app in a real browser — unlike
// Jest+Supertest (server/src/tests), which hits the Express API directly and
// never renders React. Per CLAUDE.md's testing stack, Cypress is scoped to
// "critical adoption flows only" (login/redirect, apply, etc.), not general
// coverage — that's what the 70% Jest/Supertest target is for.
//
// Requires BOTH dev servers running locally before `npm run cypress:open` /
// `cypress:run`: the Vite dev server (client, `npm run dev`, port 3000 —
// baseUrl below) and the Express API (server, `npm run dev`, port 5000,
// proxied from /api by vite.config.ts). Specs seed their own test data via
// cy.request() straight to the API rather than relying on pre-existing rows.
export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
  },
});
