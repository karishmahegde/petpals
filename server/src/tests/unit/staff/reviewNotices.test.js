// The review outcome emails (services/staff/reviewNotices.js): government ID
// verified/rejected and adoption application approved/declined — which
// template each gets, what goes in it, and that a failure never reaches the
// caller. Prisma and the email service are mocked.
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
  governmentIdReviewed,
  applicationsDecided,
} = require("../../../services/staff/reviewNotices");

const RELATION = {
  Adopter: ["adopter", "adopterName"],
  Staff: ["staff", "staffName"],
  Volunteer: ["volunteer", "volunteerName"],
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

const sent = () => queueEmail.mock.calls.map(([message]) => message);

beforeEach(() => {
  jest.resetAllMocks();
});

describe("governmentIdReviewed", () => {
  test("Verified → the verified email, no approval line for an Active account", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Adopter"));

    await governmentIdReviewed(7, "Verified");

    const [message] = sent();
    expect(message.to).toBe("sam@example.test");
    expect(message.subject).toBe("Your government ID is verified");
    expect(message.text).toContain("Hi Sam,");
    expect(message.text).not.toContain("waiting for approval");
  });

  test("Verified for a Pending worker → says approval is still to come", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Staff", "Pending"));

    await governmentIdReviewed(7, "Verified");

    expect(sent()[0].text).toContain("still waiting for approval");
  });

  test("Rejected → re-upload from Profile, adopter login link", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Adopter"));

    await governmentIdReviewed(7, "Rejected");

    const [message] = sent();
    expect(message.subject).toBe("Your government ID needs another look");
    expect(message.text).toContain("upload a new one from your Profile");
    expect(message.text).toMatch(/Log in: \S+\/login$/m);
  });

  test("Rejected for a Pending staff member → approval page, staff-portal login", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Staff", "Pending"));

    await governmentIdReviewed(7, "Rejected");

    const { text } = sent()[0];
    expect(text).toContain("upload a new one from the approval page");
    expect(text).toContain("/staff-portal/login");
  });

  test("Rejected for a Pending volunteer → public login (volunteers aren't workers)", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(userRow("Volunteer", "Pending"));

    await governmentIdReviewed(7, "Rejected");

    expect(sent()[0].text).toMatch(/Log in: \S+\/login$/m);
  });

  test("any other status → nothing looked up or sent", async () => {
    await governmentIdReviewed(7, "Pending");

    expect(prisma.users.findUnique).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("user gone → nothing sent", async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);

    await governmentIdReviewed(7, "Verified");

    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("a failed lookup is logged, never thrown", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    prisma.users.findUnique.mockRejectedValueOnce(new Error("db down"));

    await expect(governmentIdReviewed(7, "Verified")).resolves.toBeUndefined();
    expect(queueEmail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("db down"));
    error.mockRestore();
  });
});

describe("applicationsDecided", () => {
  const decided = (applications) =>
    applicationsDecided({ petName: "Rex", shelterName: "Athens Shelter", applications });

  test("Accepted → the approved email, with the shelter's note", () => {
    decided([{ email: "sam@example.test", name: "Sam", status: "Accepted", staffRemark: "See you Saturday" }]);

    const [message] = sent();
    expect(message.to).toBe("sam@example.test");
    expect(message.subject).toBe("Your application for Rex was approved");
    expect(message.text).toContain("Athens Shelter has approved your adoption application for Rex");
    expect(message.text).toContain('A note from the shelter: "See you Saturday"');
    expect(message.text).toContain("/adopter/applications");
  });

  test("Rejected without a remark → the declined email, no note line", () => {
    decided([{ email: "sam@example.test", name: "Sam", status: "Rejected" }]);

    const [message] = sent();
    expect(message.subject).toBe("An update on your application for Rex");
    expect(message.text).not.toContain("A note from the shelter");
    expect(message.text).toContain("/adopt");
  });

  test("one email per application, each to its own applicant", () => {
    decided([
      { email: "sam@example.test", name: "Sam", status: "Accepted" },
      { email: "ali@example.test", name: "Ali", status: "Rejected", staffRemark: "Another applicant was approved" },
      { email: "jo@example.test", name: "Jo", status: "Rejected", staffRemark: "Another applicant was approved" },
    ]);

    expect(sent().map((m) => [m.to, m.subject])).toEqual([
      ["sam@example.test", "Your application for Rex was approved"],
      ["ali@example.test", "An update on your application for Rex"],
      ["jo@example.test", "An update on your application for Rex"],
    ]);
  });

  test("Withdrawn, or no email address → skipped", () => {
    decided([
      { email: "sam@example.test", name: "Sam", status: "Withdrawn" },
      { email: undefined, name: "Ali", status: "Rejected" },
    ]);

    expect(queueEmail).not.toHaveBeenCalled();
  });

  test("the remark is escaped in the HTML part", () => {
    decided([{ email: "sam@example.test", name: "Sam", status: "Rejected", staffRemark: "<b>no</b>" }]);

    expect(sent()[0].html).toContain("&lt;b&gt;no&lt;/b&gt;");
    expect(sent()[0].html).not.toContain("<b>no</b>");
  });
});
