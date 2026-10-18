// password.ts
// The password rules, checked off live as the user types — the same five
// the server enforces on register, reset and change (server/src/utils/
// password.js), so a password that passes here won't be refused there.
export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
  {
    label: "One special character (!@#$%^&*)",
    test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw),
  },
];

export const meetsPasswordRequirements = (password: string): boolean =>
  PASSWORD_REQUIREMENTS.every((req) => req.test(password));
