// The notification hooks with no other unit suite to live in: a paid
// application (finalizeApplication), a new visit request, a donation, an
// admin sign-up — and notifyAppointment, which decides who hears about each
// appointment create/edit/cancel. Prisma and services/notifications are
// mocked; the message text is the real one.
jest.mock("../../../config/prisma", () => ({
  adoptionApplication: { create: jest.fn() },
  shelter: { findUnique: jest.fn() },
  pet: { findUnique: jest.fn() },
  visit: { create: jest.fn() },
  adopter: { findUnique: jest.fn() },
  donation: { create: jest.fn() },
  users: { findUnique: jest.fn() },
  appointment: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../../config/stripe", () => ({}));
jest.mock("../../../services/storage", () => ({}));
jest.mock("../../../services/auth/emailVerification.service", () => ({
  sendVerificationEmail: jest.fn(),
  assertEmailVerified: jest.fn(),
}));
jest.mock("../../../services/notifications", () => require("./notificationsMock"));

const prisma = require("../../../config/prisma");
const notifications = require("../../../services/notifications");
const { finalizeApplication } = require("../../../services/adopter/adoptionApplications.service");
const { createVisit } = require("../../../services/adopter/visits.service");
const { finalizeDonation } = require("../../../services/donor/donations.service");
const { register } = require("../../../services/auth/auth.service");
const {
  notifyAppointment,
  updateAppointment,
} = require("../../../services/staff/appointments.service");

const { notify, messages } = notifications;

// notify's calls as [userIDs, type] pairs, in order.
const sent = () => notify.mock.calls.map(([userIDs, message]) => [userIDs, message.type]);

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  notify.mockResolvedValue([]);
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ——————————————— finalizeApplication (Stripe webhook) ———————————————
describe("finalizeApplication", () => {
  const session = {
    id: "cs_test_1",
    payment_intent: "pi_1",
    metadata: {
      petID: "12",
      adopterID: "7",
      shelterID: "3",
      applicationType: "Adopt",
      shelterMessage: "",
    },
  };

  test("tells the adopter it's in, and every staff member at the shelter", async () => {
    prisma.adoptionApplication.create.mockResolvedValue({
      pet: { petName: "Rocky" },
      shelter: { shelterName: "Downtown" },
      adopter: { adopterName: "Sam" },
    });
    notifications.shelterStaffIDs.mockResolvedValue([40, 41]);

    await finalizeApplication(session);

    expect(notifications.shelterStaffIDs).toHaveBeenCalledWith(3);
    expect(notify).toHaveBeenCalledWith(
      [7],
      messages.applicationSubmitted({ petName: "Rocky", shelterName: "Downtown" }),
    );
    expect(notify).toHaveBeenCalledWith(
      [40, 41],
      messages.newApplication({ adopterName: "Sam", petName: "Rocky" }),
    );
  });

  test("a duplicate (no row created) notifies no one", async () => {
    prisma.adoptionApplication.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    await finalizeApplication(session);

    expect(notify).not.toHaveBeenCalled();
  });
});

// ——————————————— createVisit ———————————————
describe("createVisit", () => {
  const visitRow = { visitID: 5, adopterID: 7, shelterID: 3, petID: 12 };

  beforeEach(() => {
    prisma.shelter.findUnique.mockResolvedValue({ shelterID: 3 });
    prisma.visit.create.mockResolvedValue(visitRow);
    prisma.adopter.findUnique.mockResolvedValue({ adopterName: "Sam" });
    notifications.shelterStaffIDs.mockResolvedValue([40, 41]);
  });

  test("tells the shelter's staff who asked and which pet", async () => {
    prisma.pet.findUnique.mockResolvedValue({ petID: 12, petName: "Rocky" });

    await createVisit({ adopterID: 7, shelterID: 3, petID: 12, visitTime: new Date() });

    expect(notifications.shelterStaffIDs).toHaveBeenCalledWith(3);
    expect(notify).toHaveBeenCalledWith(
      [40, 41],
      messages.newVisitRequest({ adopterName: "Sam", petName: "Rocky" }),
    );
  });

  test("a plain shelter visit leaves the pet out", async () => {
    await createVisit({ adopterID: 7, shelterID: 3, visitTime: new Date() });

    expect(notify).toHaveBeenCalledWith(
      [40, 41],
      messages.newVisitRequest({ adopterName: "Sam", petName: undefined }),
    );
  });

  test("the visit is still returned if the notification lookup fails", async () => {
    notifications.shelterStaffIDs.mockRejectedValue(new Error("lookup failed"));

    await expect(
      createVisit({ adopterID: 7, shelterID: 3, visitTime: new Date() }),
    ).resolves.toEqual(visitRow);
    expect(notify).not.toHaveBeenCalled();
  });
});

// ——————————————— finalizeDonation (Stripe webhook) ———————————————
describe("finalizeDonation", () => {
  const session = {
    id: "cs_test_2",
    amount_total: 5000,
    metadata: { donorID: "8", shelterID: "3", donationDesc: "" },
  };

  test("thanks the donor with the amount Stripe charged", async () => {
    prisma.donation.create.mockResolvedValue({
      donationAmt: "50.00",
      shelter: { shelterName: "Downtown" },
    });

    await finalizeDonation(session);

    expect(notify).toHaveBeenCalledWith(
      [8],
      messages.donationReceived({ amount: 50, shelterName: "Downtown" }),
    );
  });

  test("a replayed webhook (already recorded) doesn't thank twice", async () => {
    prisma.donation.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    await finalizeDonation(session);

    expect(notify).not.toHaveBeenCalled();
  });
});

// ——————————————— register (admin sign-up) ———————————————
describe("register", () => {
  // The transaction callback runs against a tx whose admin.count says
  // whether any admin exists yet.
  const runTransaction = (adminCount) =>
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        users: { create: jest.fn().mockResolvedValue({ userID: 21, userEmail: "a@x.test" }) },
        admin: { count: jest.fn().mockResolvedValue(adminCount), create: jest.fn() },
        adopter: { create: jest.fn() },
      }),
    );

  const signUp = (role) =>
    register({ name: "Alex", email: "a@x.test", password: "Passw0rd!", role });

  beforeEach(() => {
    prisma.users.findUnique.mockResolvedValue(null);
  });

  test("a Pending admin sign-up tells every active admin", async () => {
    runTransaction(2);
    notifications.activeAdminIDs.mockResolvedValue([1, 2]);

    await signUp("admin");

    expect(notify).toHaveBeenCalledWith([1, 2], messages.adminSignupPending({ name: "Alex" }));
  });

  test("the very first admin (auto-activated) has no one to tell", async () => {
    runTransaction(0);

    await signUp("admin");

    expect(notify).not.toHaveBeenCalled();
  });

  test("other roles' approvers hear at onboarding, not at sign-up", async () => {
    runTransaction(2);

    await signUp("adopter");

    expect(notify).not.toHaveBeenCalled();
  });
});

// ——————————————— notifyAppointment ———————————————
describe("notifyAppointment", () => {
  const pet = { petID: 12, petName: "Rocky" };
  const DATE = new Date("2026-11-02T15:00:00Z");
  const slot = (overrides = {}) => ({
    vetID: 30,
    volunteerID: 50,
    appointmentDate: DATE,
    appointmentReason: "Checkup",
    ...overrides,
  });
  const STAFF_ACTOR = 40;
  const ADOPTER = 7;

  const run = ({ before, after, actorID = STAFF_ACTOR }) =>
    notifyAppointment({ appointmentID: 9, pet, before, after, actorID });

  beforeEach(() => {
    notifications.acceptedAdopterForPet.mockResolvedValue(ADOPTER);
  });

  test("a new appointment: assigned to the vet and volunteer, scheduled for the adopter", async () => {
    await run({ before: null, after: { vetID: 30, volunteerID: 50 } });

    expect(notifications.acceptedAdopterForPet).toHaveBeenCalledWith(12);
    expect(sent()).toEqual([
      [[30], "AppointmentAssigned"],
      [[50], "AppointmentAssistAssigned"],
      [[ADOPTER], "AppointmentScheduled"],
    ]);
  });

  test("a new appointment with no volunteer and no adopted pet: only the vet hears", async () => {
    notifications.acceptedAdopterForPet.mockResolvedValue(null);

    await run({ before: null, after: { vetID: 30, volunteerID: null } });

    expect(sent()).toEqual([[[30], "AppointmentAssigned"]]);
  });

  test("a new date: changed for the vet, the volunteer and the adopter", async () => {
    await run({
      before: slot(),
      after: slot({ appointmentDate: "2026-11-03T15:00:00.000Z" }),
    });

    expect(notify.mock.calls.map(([ids, m]) => [ids, m.type, m.link])).toEqual([
      [[30], "AppointmentChanged", "/vet/appointments"],
      [[50], "AppointmentChanged", "/volunteer/appointments"],
      [[ADOPTER], "AppointmentChanged", "/adopter/appointments"],
    ]);
  });

  test("a new reason counts as a change too", async () => {
    await run({ before: slot(), after: slot({ appointmentReason: "Follow-up" }) });

    expect(sent().map(([, type]) => type)).toEqual([
      "AppointmentChanged",
      "AppointmentChanged",
      "AppointmentChanged",
    ]);
  });

  test("saving it unchanged tells no one", async () => {
    await run({ before: slot(), after: slot({ appointmentDate: DATE.toISOString() }) });

    expect(notify).not.toHaveBeenCalled();
    expect(notifications.acceptedAdopterForPet).not.toHaveBeenCalled();
  });

  test("a vet swap: cancelled for the old vet, assigned to the new, a change for the adopter", async () => {
    await run({ before: slot(), after: slot({ vetID: 31 }) });

    expect(sent()).toEqual([
      [[30], "AppointmentCancelled"],
      [[31], "AppointmentAssigned"],
      [[ADOPTER], "AppointmentChanged"],
    ]);
    expect(notify.mock.calls[0][1].link).toBe("/vet/appointments");
  });

  test("a vet swap plus a new date: the new vet gets just the assignment", async () => {
    await run({
      before: slot(),
      after: slot({ vetID: 31, appointmentDate: new Date("2026-11-03T15:00:00Z") }),
    });

    expect(sent()).toEqual([
      [[30], "AppointmentCancelled"],
      [[31], "AppointmentAssigned"],
      [[50], "AppointmentChanged"],
      [[ADOPTER], "AppointmentChanged"],
    ]);
  });

  test("a volunteer swap isn't news to the adopter", async () => {
    await run({ before: slot(), after: slot({ volunteerID: 51 }) });

    expect(sent()).toEqual([
      [[50], "AppointmentAssistCancelled"],
      [[51], "AppointmentAssistAssigned"],
    ]);
    expect(notifications.acceptedAdopterForPet).not.toHaveBeenCalled();
  });

  test("unassigning the volunteer tells only them", async () => {
    await run({ before: slot(), after: slot({ volunteerID: null }) });

    expect(sent()).toEqual([[[50], "AppointmentAssistCancelled"]]);
  });

  test("a cancellation: cancelled for the vet, the volunteer and the adopter", async () => {
    await run({ before: slot(), after: null });

    expect(notify.mock.calls.map(([ids, m]) => [ids, m.type, m.link])).toEqual([
      [[30], "AppointmentCancelled", "/vet/appointments"],
      [[50], "AppointmentAssistCancelled", "/volunteer/appointments"],
      [[ADOPTER], "AppointmentCancelled", "/adopter/appointments"],
    ]);
  });

  test("nobody is told about their own edit (the vet rescheduling)", async () => {
    await run({ before: slot(), after: slot({ appointmentReason: "Follow-up" }), actorID: 30 });

    expect(sent()).toEqual([
      [[50], "AppointmentChanged"],
      [[ADOPTER], "AppointmentChanged"],
    ]);
  });

  test("each recipient gets their own row", async () => {
    await run({ before: null, after: { vetID: 30, volunteerID: 50 } });

    for (const [userIDs] of notify.mock.calls) expect(userIDs).toHaveLength(1);
  });

  test("a failed lookup is logged and swallowed", async () => {
    notifications.acceptedAdopterForPet.mockRejectedValue(new Error("lookup failed"));

    await expect(run({ before: null, after: { vetID: 30, volunteerID: null } })).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("appointment 9: lookup failed"),
    );
  });

  test("wired into updateAppointment: a vet's reschedule tells the others, not the vet", async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      ...slot({ appointmentDate: new Date(Date.now() + 86400000) }),
      petID: 12,
      shelterID: 3,
      appointmentStatus: "Scheduled",
      pet,
    });
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.appointment.update.mockResolvedValue({});

    await updateAppointment(9, { appointmentReason: "Follow-up" }, { role: "Veterinarian", userID: 30 });

    expect(sent()).toEqual([
      [[50], "AppointmentChanged"],
      [[ADOPTER], "AppointmentChanged"],
    ]);
  });
});
