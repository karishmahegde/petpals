// notify() and the recipient lookups (services/notifications/index.js):
// who gets a row, that the text is clipped to the columns, that each row is
// pushed to its owner's streams — and that no failure ever reaches the
// service that called it. Prisma and the hub are mocked.
jest.mock("../../../config/prisma", () => ({
  notification: { createManyAndReturn: jest.fn() },
  staff: { findMany: jest.fn() },
  shelter: { findUnique: jest.fn() },
  admin: { findMany: jest.fn() },
  adoptionApplication: { findFirst: jest.fn() },
}));
jest.mock("../../../services/notifications/hub", () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
  frame: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const hub = require("../../../services/notifications/hub");
const notifications = require("../../../services/notifications");

const { notify, notifyAfterLookup, messages } = notifications;

const message = messages.capacityAlert({ shelterName: "Downtown" });

// What createManyAndReturn gives back: the inserted rows, with IDs.
const echoRows = () =>
  prisma.notification.createManyAndReturn.mockImplementation(async ({ data }) =>
    data.map((row, i) => ({
      notificationID: 100 + i,
      readAt: null,
      createdAt: new Date("2026-10-20T09:00:00Z"),
      ...row,
    })),
  );

let consoleErrorSpy;

beforeEach(() => {
  jest.resetAllMocks();
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("notify", () => {
  test("stores one row per recipient and returns them", async () => {
    echoRows();

    const rows = await notify([4, 9], message);

    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { userID: 4, ...message },
        { userID: 9, ...message },
      ],
    });
    expect(rows.map((r) => r.userID)).toEqual([4, 9]);
  });

  test("drops nulls, non-integers and repeats", async () => {
    echoRows();

    await notify([4, null, undefined, 4, "9", 9, 9], message);

    const { data } = prisma.notification.createManyAndReturn.mock.calls[0][0];
    expect(data.map((r) => r.userID)).toEqual([4, 9]);
  });

  test("with no one left to tell, writes nothing", async () => {
    await expect(notify([null, undefined], message)).resolves.toEqual([]);
    await expect(notify([], message)).resolves.toEqual([]);
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(hub.publish).not.toHaveBeenCalled();
  });

  test("a missing link is stored as null", async () => {
    echoRows();
    const { link, ...withoutLink } = message;

    await notify([4], withoutLink);

    expect(prisma.notification.createManyAndReturn.mock.calls[0][0].data[0].link).toBeNull();
  });

  test("clips title, body and link to their column lengths with an ellipsis", async () => {
    echoRows();

    await notify([4], {
      type: "CapacityAlert",
      title: "t".repeat(130),
      body: "b".repeat(310),
      link: `/${"l".repeat(210)}`,
    });

    const [row] = prisma.notification.createManyAndReturn.mock.calls[0][0].data;
    expect(row.title).toHaveLength(120);
    expect(row.title.endsWith("…")).toBe(true);
    expect(row.body).toHaveLength(300);
    expect(row.link).toHaveLength(200);
  });

  test("text already within the limits is stored unchanged", async () => {
    echoRows();

    await notify([4], { ...message, title: "t".repeat(120) });

    expect(prisma.notification.createManyAndReturn.mock.calls[0][0].data[0].title).toBe(
      "t".repeat(120),
    );
  });

  test("pushes each row to its owner's streams, without the userID", async () => {
    echoRows();

    await notify([4, 9], message);

    expect(hub.publish).toHaveBeenCalledTimes(2);
    expect(hub.publish).toHaveBeenNthCalledWith(1, 4, "notification", {
      notificationID: 100,
      readAt: null,
      createdAt: new Date("2026-10-20T09:00:00Z"),
      ...message,
    });
    expect(hub.publish.mock.calls[1][0]).toBe(9);
    expect(hub.publish.mock.calls[1][2]).not.toHaveProperty("userID");
  });

  test("a failed insert is logged and swallowed — nothing is pushed", async () => {
    prisma.notification.createManyAndReturn.mockRejectedValue(new Error("connection lost"));

    await expect(notify([4, 9], message)).resolves.toEqual([]);

    expect(hub.publish).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("couldn't store CapacityAlert for users 4, 9: connection lost"),
    );
  });

  test("a failed push still returns the stored rows", async () => {
    echoRows();
    hub.publish.mockImplementation(() => {
      throw new Error("socket gone");
    });

    const rows = await notify([4], message);

    expect(rows).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("couldn't push CapacityAlert: socket gone"),
    );
  });
});

describe("notifyAfterLookup", () => {
  test("notifies whoever the lookup returns", async () => {
    echoRows();

    const rows = await notifyAfterLookup("a test", async () => [[4], message]);

    expect(rows).toHaveLength(1);
    expect(prisma.notification.createManyAndReturn.mock.calls[0][0].data[0].userID).toBe(4);
  });

  test("a failed lookup is logged with its context and swallowed", async () => {
    await expect(
      notifyAfterLookup("the transfer 7 notice", async () => {
        throw new Error("lookup failed");
      }),
    ).resolves.toEqual([]);

    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("couldn't prepare the transfer 7 notice: lookup failed"),
    );
  });
});

describe("recipient lookups", () => {
  test("shelterStaffIDs: the shelter's Active staff", async () => {
    prisma.staff.findMany.mockResolvedValue([{ userID: 4 }, { userID: 5 }]);

    await expect(notifications.shelterStaffIDs(3)).resolves.toEqual([4, 5]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { shelterID: 3, accountStatus: "Active" },
      select: { userID: true },
    });
  });

  test.each([
    [{ manager: { userID: 4, accountStatus: "Active" } }, 4],
    [{ manager: { userID: 4, accountStatus: "Deactivated" } }, null],
    [{ manager: null }, null],
    [null, null],
  ])("shelterManagerID: %j → %s", async (shelter, expected) => {
    prisma.shelter.findUnique.mockResolvedValue(shelter);

    await expect(notifications.shelterManagerID(3)).resolves.toBe(expected);
  });

  test("activeAdminIDs: Active admins only", async () => {
    prisma.admin.findMany.mockResolvedValue([{ userID: 1 }, { userID: 2 }]);

    await expect(notifications.activeAdminIDs()).resolves.toEqual([1, 2]);
    expect(prisma.admin.findMany).toHaveBeenCalledWith({
      where: { accountStatus: "Active" },
      select: { userID: true },
    });
  });

  test("acceptedAdopterForPet: the Accepted application's adopter, or null", async () => {
    prisma.adoptionApplication.findFirst.mockResolvedValueOnce({ adopterID: 7 });
    await expect(notifications.acceptedAdopterForPet(12)).resolves.toBe(7);
    expect(prisma.adoptionApplication.findFirst).toHaveBeenCalledWith({
      where: { petID: 12, applicationStatus: "Accepted" },
      select: { adopterID: true },
    });

    prisma.adoptionApplication.findFirst.mockResolvedValueOnce(null);
    await expect(notifications.acceptedAdopterForPet(12)).resolves.toBeNull();
  });

  describe("signupApproverIDs", () => {
    test("a Manager sign-up → the admins", async () => {
      prisma.admin.findMany.mockResolvedValue([{ userID: 1 }]);

      await expect(notifications.signupApproverIDs("Manager", 3)).resolves.toEqual([1]);
    });

    test("a Volunteer → every staff member at their shelter", async () => {
      prisma.staff.findMany.mockResolvedValue([{ userID: 4 }, { userID: 5 }]);

      await expect(notifications.signupApproverIDs("Volunteer", 3)).resolves.toEqual([4, 5]);
    });

    test.each(["Staff", "Veterinarian"])("a %s → the shelter's manager", async (kind) => {
      prisma.shelter.findUnique.mockResolvedValue({
        manager: { userID: 4, accountStatus: "Active" },
      });

      await expect(notifications.signupApproverIDs(kind, 3)).resolves.toEqual([4]);
    });

    test("no shelter yet → no one (except for a Manager)", async () => {
      await expect(notifications.signupApproverIDs("Staff", null)).resolves.toEqual([]);
      await expect(notifications.signupApproverIDs("Volunteer", null)).resolves.toEqual([]);
      expect(prisma.staff.findMany).not.toHaveBeenCalled();
      expect(prisma.shelter.findUnique).not.toHaveBeenCalled();
    });
  });
});
