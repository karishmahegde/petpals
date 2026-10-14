// Runs before every test file (jest.config.js setupFiles). app.js loads
// server/.env, which may hold a real AI key — set to empty here first, the
// AI_* vars stay empty (dotenv never overrides a var that's already set), so
// services/ai reports "not configured" and generateStructured rejects without
// a network call. Suites that exercise AI mock services/ai, or set their own
// fake config with a mocked fetch (ai/aiClient.test.js).
["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"].forEach((name) => {
  process.env[name] = "";
});
