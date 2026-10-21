// The in-app notification text (services/notifications/messages.js): one
// builder per NotificationType, each row fitting the Notification columns
// and linking to the page where the recipient acts on it.
const fs = require("fs");
const path = require("path");
const messages = require("../../../services/notifications/messages");

// The NotificationType enum, read from schema.prisma so a type added there
// without a builder (or the reverse) fails here.
const schemaTypes = () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../../../prisma/schema.prisma"),
    "utf8",
  );
  const body = schema.match(/enum NotificationType \{([^}]*)\}/)[1];
  return body
    .split("\n")
    .map((line) => line.replace(/\/\/.*/, "").trim())
    .filter(Boolean);
};

// Typical arguments for each builder — every one of them is called below.
const SAMPLE_ARGS = {
  applicationSubmitted: { petName: "Rocky", shelterName: "Downtown" },
  applicationApproved: { petName: "Rocky", shelterName: "Downtown" },
  applicationDeclined: { petName: "Rocky", shelterName: "Downtown" },
  visitConfirmed: { shelterName: "Downtown", petName: "Rocky", visitID: 5 },
  visitCancelled: { shelterName: "Downtown", petName: "Rocky", visitID: 5 },
  appointmentScheduled: { petName: "Rocky" },
  appointmentChanged: { petName: "Rocky", role: "Adopter" },
  appointmentCancelled: { petName: "Rocky", role: "Adopter" },
  governmentIdVerified: { role: "Staff" },
  governmentIdRejected: { role: "Staff" },
  newApplication: { adopterName: "Sam", petName: "Rocky" },
  newVisitRequest: { adopterName: "Sam", petName: "Rocky" },
  applicationWithdrawn: { adopterName: "Sam", petName: "Rocky" },
  visitCancelledByAdopter: { adopterName: "Sam", petName: "Rocky" },
  signupReadyForApproval: { name: "Alex", kind: "Volunteer" },
  transferIncoming: { petName: "Rocky", fromShelterName: "Downtown" },
  transferCompleted: { petName: "Rocky", toShelterName: "Uptown" },
  transferRejected: { petName: "Rocky", toShelterName: "Uptown" },
  transferCancelled: { petName: "Rocky", fromShelterName: "Downtown" },
  capacityAlert: { shelterName: "Downtown" },
  appointmentAssigned: { petName: "Rocky" },
  taskAssigned: { taskName: "Feeding" },
  eventAssigned: { eventName: "Adoption Fair" },
  eventCancelled: { eventName: "Adoption Fair" },
  appointmentAssistAssigned: { petName: "Rocky" },
  appointmentAssistCancelled: { petName: "Rocky" },
  donationReceived: { amount: 50, shelterName: "Downtown" },
  adminSignupPending: { name: "Alex" },
};

const pascal = (name) => name[0].toUpperCase() + name.slice(1);

test("there is exactly one builder per NotificationType", () => {
  expect(Object.keys(messages).map(pascal).sort()).toEqual(schemaTypes().sort());
  expect(Object.keys(SAMPLE_ARGS).sort()).toEqual(Object.keys(messages).sort());
});

describe.each(Object.keys(SAMPLE_ARGS))("%s", (name) => {
  const row = messages[name](SAMPLE_ARGS[name]);

  test("is tagged with its own type", () => {
    expect(row.type).toBe(pascal(name));
  });

  test("fits the Notification columns and links to a client path (+ an item's ID)", () => {
    expect(row.title.length).toBeGreaterThan(0);
    expect(row.title.length).toBeLessThanOrEqual(120);
    expect(row.body.length).toBeGreaterThan(0);
    expect(row.body.length).toBeLessThanOrEqual(300);
    expect(row.link).toMatch(/^\/[a-z]+(\/[a-z-]+)*(\?[a-zA-Z]+=\d+)?$/);
  });

  test("leaves no blanks from missing arguments", () => {
    expect(row.body).not.toMatch(/undefined|null|NaN/);
  });
});

describe("role-dependent links", () => {
  test.each([
    ["Adopter", "/adopter/appointments"],
    ["Veterinarian", "/vet/appointments"],
  ])("an appointment change or cancellation for a %s → %s", (role, link) => {
    expect(messages.appointmentChanged({ petName: "Rocky", role }).link).toBe(link);
    expect(messages.appointmentCancelled({ petName: "Rocky", role }).link).toBe(link);
  });

  test.each([
    ["Adopter", "/adopter/profile"],
    ["Staff", "/staff/profile"],
    ["Veterinarian", "/vet/profile"],
    ["Volunteer", "/volunteer/profile"],
  ])("a government ID review for a %s → %s", (role, link) => {
    expect(messages.governmentIdVerified({ role }).link).toBe(link);
    expect(messages.governmentIdRejected({ role }).link).toBe(link);
  });

  test.each([
    ["Volunteer", "volunteer", "/staff/volunteers"],
    ["Staff", "staff member", "/staff/team"],
    ["Veterinarian", "veterinarian", "/staff/vets"],
    ["Manager", "shelter manager", "/admin/staff"],
  ])("a %s sign-up names the role and links to its approvers' page", (kind, label, link) => {
    const row = messages.signupReadyForApproval({ name: "Alex", kind });
    expect(row.body).toBe(`Alex finished signing up as a ${label} and is waiting for approval.`);
    expect(row.link).toBe(link);
  });
});

describe("item links", () => {
  test.each(["visitConfirmed", "visitCancelled"])(
    "%s opens that visit on the adopter's Visits page",
    (name) => {
      expect(messages[name]({ shelterName: "Downtown", petName: "Rocky", visitID: 42 }).link).toBe(
        "/adopter/visits?visitID=42",
      );
    },
  );
});

describe("optional and mapped values", () => {
  test.each(["visitConfirmed", "visitCancelled"])(
    "%s without a pet is a plain shelter visit",
    (name) => {
      const withPet = messages[name]({ shelterName: "Downtown", petName: "Rocky", visitID: 5 });
      const withoutPet = messages[name]({ shelterName: "Downtown", petName: undefined, visitID: 5 });
      expect(withPet.body).toContain("to meet Rocky");
      expect(withoutPet.body).toMatch(/^Downtown (confirmed|cancelled) your visit\.$/);
    },
  );

  test.each(["newVisitRequest", "visitCancelledByAdopter"])(
    "%s without a pet leaves the pet out",
    (name) => {
      const row = messages[name]({ adopterName: "Sam", petName: undefined });
      expect(row.body).toMatch(/^Sam .*visit\.$/);
      expect(row.body).not.toContain("meet");
    },
  );

  test.each([
    ["Animal_Care", "an animal care task"],
    ["Vet_Assistance", "a vet assistance task"],
    ["Events", "an event support task"],
    ["Other", "a new task"],
    ["SomethingNew", "a new task"],
  ])("taskAssigned names %s as %s", (taskName, phrase) => {
    expect(messages.taskAssigned({ taskName }).body).toBe(`You've been assigned ${phrase}.`);
  });

  test("donationReceived formats the amount as US dollars", () => {
    expect(messages.donationReceived({ amount: 1250, shelterName: "Downtown" }).body).toBe(
      "Your $1,250.00 donation to Downtown has been received.",
    );
  });
});
