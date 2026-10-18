// Runs before every test file (jest.config.js setupFiles). app.js loads
// server/.env, which may hold a real Brevo key — set to empty here first, the
// EMAIL_* vars stay empty (dotenv never overrides a var that's already set), so
// services/email reports "not configured" and no test can send real mail.
// Suites that assert on emails mock services/email; email/emailService.test.js
// sets its own fake config with a mocked fetch.
["EMAIL_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"].forEach((name) => {
  process.env[name] = "";
});
