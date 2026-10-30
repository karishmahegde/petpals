const { isDemoAccount, assertNotDemoAccount } = require("../../../services/auth/demoAccounts");

// The shared demo logins' guard (config/demoAccounts.js). The flows it guards
// (password and email change, password reset, closing an account) each have a
// demo case in their own suite.
describe("demoAccounts", () => {
  test.each(["adopter@petpals.com", " Volunteer@PetPals.com ", "DONOR@petpals.com"])(
    "%p is a demo account",
    (email) => {
      expect(isDemoAccount(email)).toBe(true);
    },
  );

  test.each(["staff@petpals.com", "someone@example.com", "", null, undefined])(
    "%p isn't",
    (email) => {
      expect(isDemoAccount(email)).toBe(false);
    },
  );

  test("assertNotDemoAccount → 409 demo_account for a demo contact", () => {
    expect(() => assertNotDemoAccount({ email: "adopter@petpals.com" })).toThrow(
      expect.objectContaining({ code: "CONFLICT", details: { reason: "demo_account" } }),
    );
  });

  test("assertNotDemoAccount passes any other contact, or none", () => {
    expect(() => assertNotDemoAccount({ email: "sam@example.test" })).not.toThrow();
    expect(() => assertNotDemoAccount(null)).not.toThrow();
  });
});
