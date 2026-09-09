// Platform-wide fee constants — not DB columns (see AdoptionApplication.amountPaid,
// which snapshots what was actually charged independently of this value).
// Kept in their own file, separate from business logic, so they're easy to
// find and update.

// $15.00 flat adoption-application processing fee, applies to both
// applicationType values (Adopt and Foster) — see Sprint 3 Part 5 spec.
const APPLICATION_FEE_CENTS = 1500;
const APPLICATION_FEE_USD = APPLICATION_FEE_CENTS / 100;

module.exports = { APPLICATION_FEE_CENTS, APPLICATION_FEE_USD };
