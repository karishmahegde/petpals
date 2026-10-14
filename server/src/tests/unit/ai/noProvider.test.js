// Guards tests/setup/noAiProvider.js: loading the app (which reads
// server/.env) must still leave AI unconfigured, so no test can reach the
// provider through a path that forgot to mock services/ai.
require("../../../app");
const { AI_ERROR_REASONS, isAiConfigured, generateStructured } = require("../../../services/ai");

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test("AI stays unconfigured in tests even after app.js loads .env", async () => {
  expect(isAiConfigured()).toBe(false);
  await expect(
    generateStructured({ system: "s", user: "u", schemaName: "x", schema: { type: "object" } }),
  ).rejects.toMatchObject({ reason: AI_ERROR_REASONS.NOT_CONFIGURED });
  expect(global.fetch).not.toHaveBeenCalled();
});
