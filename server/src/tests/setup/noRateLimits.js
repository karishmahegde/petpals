// Runs before every test file (jest.config.js setupFiles). Suites log in and
// sign up far more often than the limits in config/rateLimits.js allow, so
// every limiter is switched off. middleware/rateLimit.test.js unsets this to
// exercise the limits themselves.
process.env.RATE_LIMITS = "off";
