module.exports = {
  // Integration tests run against the remote Supabase database, where a
  // chained register/login/HTTP test or a beforeAll with many creates can take
  // longer than Jest's 5s default. A timed-out hook keeps running in the
  // background (Jest doesn't cancel it), racing the cleanup and leaving
  // orphaned rows behind — so the limit sits well above normal run times.
  // Unit tests are fully mocked and finish in milliseconds either way.
  // A suite needing more sets its own jest.setTimeout (sprint5_1Journeys).
  testTimeout: 30000,
  // No test ever reaches the AI or email provider — see the files.
  setupFiles: [
    "<rootDir>/src/tests/setup/noAiProvider.js",
    "<rootDir>/src/tests/setup/noEmailProvider.js",
  ],
};
