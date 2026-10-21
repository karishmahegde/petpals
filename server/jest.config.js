module.exports = {
  // Integration tests run against the remote Supabase database, where a
  // chained register/login/HTTP test or a beforeAll with many creates can take
  // longer than Jest's 5s default. A timed-out hook keeps running in the
  // background (Jest doesn't cancel it), racing the cleanup and leaving
  // orphaned rows behind — so the limit sits well above normal run times.
  // Unit tests are fully mocked and finish in milliseconds either way.
  // A suite needing more sets its own jest.setTimeout (sprint5_1Journeys).
  // 30s wasn't enough over the remote link: on 2026-10-21 a beforeAll with
  // several sign-ups timed out, and its cleanup ran while it was still
  // creating rows. 90s gives setup room; unit tests are unaffected.
  testTimeout: 90000,
  // Coverage counts every source file, not just the ones some test happens
  // to load — an untested file shows up as 0% instead of being invisible.
  // The seed (src/prisma/) is a one-off script, not app code.
  collectCoverageFrom: ["src/**/*.js", "!src/tests/**", "!src/prisma/**"],
  // The gate (NF-08 asks for 70%): a run with --coverage fails below these.
  // Set under the measured level (89% lines / 78% branches, 2026-10-21) so it
  // catches a real drop, not noise.
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 80, branches: 70 },
  },
  coverageReporters: ["text-summary", "lcov"],
  // No test ever reaches the AI or email provider — see the files.
  setupFiles: [
    "<rootDir>/src/tests/setup/noAiProvider.js",
    "<rootDir>/src/tests/setup/noEmailProvider.js",
  ],
};
