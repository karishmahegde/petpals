// Password strength — the same five rules the register forms check live
// (client PASSWORD_REQUIREMENTS in Register.tsx / WorkerRegister.tsx). Used by
// every endpoint that sets a new password (reset, change). Returns the list of
// unmet rules, empty when the password is fine.
const PASSWORD_RULES = [
  { label: "at least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "one uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "one lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "one number", test: (pw) => /[0-9]/.test(pw) },
  { label: "one special character", test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw) },
];

const unmetPasswordRules = (password) =>
  typeof password !== "string"
    ? PASSWORD_RULES.map((rule) => rule.label)
    : PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);

// Throws 422 VALIDATION_ERROR naming what's missing.
const assertStrongPassword = (password, field = "password") => {
  const unmet = unmetPasswordRules(password);
  if (unmet.length > 0) {
    const err = new Error(`${field} needs ${unmet.join(", ")}`);
    err.code = "VALIDATION_ERROR";
    err.details = { unmet };
    throw err;
  }
};

module.exports = { PASSWORD_RULES, unmetPasswordRules, assertStrongPassword };
