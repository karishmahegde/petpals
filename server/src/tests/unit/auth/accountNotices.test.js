// The account notice emails (services/auth/accountNotices.js): which change
// gets which email, where its login link points, and that a failure never
// reaches the caller. Prisma and the email service are mocked.
jest.mock("../../../config/prisma", () => ({
  users: { findUnique: jest.fn() },
}));

jest.mock("../../../services/email", () => ({
  queueEmail: jest.fn(),
  templates: jest.requireActual("../../../services/email/templates"),
}));

const prisma = require("../../../config/prisma");
const { queueEmail } = require("../../../services/email");
const {
  lookupContact,
  accountClosed,
  statusChanged,
  statusTemplate,
  loginUrlFor,
} = require("../../../services/auth/accountNotices");

const RELATION = {
  Adopter: ["adopter", "adopterName"],
  Donor: ["donor", "donorName"],
  Staff: ["staff", "staffName"],
  Veterinarian: ["veterinarian", "vetName"],
  Volunteer: ["volunteer", "volunteerName"],
  Admin: ["admin", "adminName"],
};

const userRow = (role, accountStatus = "Active") => {
  const [relation, nameField] = RELATION[role];
  return {
    userID: 7,
    userEmail: "sam@example.test",
    role,
    emailVerified: true,
    [relation]: { [nameField]: "Sam", accountStatus },
  };
};

const contact = { userID: 7, email: "sam@example.test", role: "Adopter", name: "Sam" };

beforeEach(() => {
  jest.resetAllMocks();
});

describe("statusTemplate", () => {
  test.each([
    ["Pending", "Active", "accountApproved"],
    ["Pending", "Declined", "accountDeclined"],
    ["Active", "Deactivated", "accountDeactivated"],
    ["Active", "Banned", "accountBanned"],
    ["Deactivated", "Banned", "accountBanned"],
    ["Deactivated", "Active", "accountRestored"],
    ["Banned", "Active", "accountRestored"],
    ["Active", "Active", null],
    ["Closed", "Active", null],
  ])("%s → %s: %s", (from, to, template) => {
    expect(statusTemplate(from, to)).toBe(template);
  });
});

describe("loginUrlFor", () => {
  test.each([
    ["Admin", "/staff-portal/login"],
    ["Staff", "/staff-portal/login"],
    ["Veterinarian", "/staff-portal/login"],
    ["Volunteer", "/login"],
    ["Adopter", "/login"],
    ["Donor", "/login"],
  ])("%s → %s (same split as the client's loginPathFor)", (role, path) => {
    expect(new URL(loginUrlFor(role)).pathname).toBe(path);
  });
});

describe("statusChanged", () => {
  test("Pending → Active: approval email to the account, worker login link", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Veterinarian"));

    await statusChanged(7, "Pending", "Active");

    const email = queueEmail.mock.calls[0][0];
    expect(email).toMatchObject({
      to: "sam@example.test",
      subject: "Your PetPals account is approved",
    });
    expect(email.text).toContain("Hi Sam,");
    expect(email.text).toContain("/staff-portal/login");
  });

  test.each([
    ["Pending", "Declined", "Your PetPals sign-up"],
    ["Active", "Deactivated", "Your PetPals account was deactivated"],
    ["Active", "Banned", "Your PetPals account was suspended"],
    ["Deactivated", "Active", "Your PetPals account is active again"],
  ])("%s → %s: \"%s\"", async (from, to, subject) => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Volunteer"));

    await statusChanged(7, from, to);

    expect(queueEmail.mock.calls[0][0].subject).toBe(subject);
  });

  test("a change with no notice → no lookup, nothing sent", async () => {
    await statusChanged(7, "Active", "Active");

    expect(prisma.users.findUnique).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("lookup fails → logged, never thrown", async () => {
    prisma.users.findUnique.mockRejectedValueOnce(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(statusChanged(7, "Pending", "Active")).resolves.toBeUndefined();

    expect(queueEmail).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toContain("couldn't send the status change notice for user 7");
    error.mockRestore();
  });

  test("account gone → nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);

    await statusChanged(7, "Pending", "Active");

    expect(queueEmail).not.toHaveBeenCalled();
  });
});

describe("lookupContact + accountClosed", () => {
  test("lookupContact returns the contact, or null (logged) when the read fails", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Donor"));
    await expect(lookupContact(7)).resolves.toMatchObject({
      email: "sam@example.test",
      name: "Sam",
      role: "Donor",
    });

    prisma.users.findUnique.mockRejectedValueOnce(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(lookupContact(7)).resolves.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test("deactivate → 'closed' email explaining how to reactivate, with the role's login link", () => {
    accountClosed({ ...contact, role: "Staff" }, "deactivate");

    const email = queueEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "sam@example.test", subject: "Your PetPals account is closed" });
    expect(email.text).toContain("reactivation link");
    expect(email.text).toContain("/staff-portal/login");
  });

  test("delete → 'deleted' email", () => {
    accountClosed(contact, "delete");

    expect(queueEmail.mock.calls[0][0]).toMatchObject({
      to: "sam@example.test",
      subject: "Your PetPals account was deleted",
    });
  });

  test("no contact (the lookup failed) → nothing sent", () => {
    accountClosed(null, "deactivate");
    expect(queueEmail).not.toHaveBeenCalled();
  });
});
