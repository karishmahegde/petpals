// A stand-in for services/notifications for the suites that check which
// notifications a service sends:
//   jest.mock("../../../services/notifications", () =>
//     require("../notifications/notificationsMock"));
// notify and the recipient lookups are jest.fns (assert on notify; give the
// lookups their IDs with mockResolvedValue). notifyAfterLookup is a plain
// function, so a suite's resetAllMocks can't strip it: it runs `prepare` and
// hands the result to notify, swallowing a failed lookup like the real one.
// messages is the real module, so the asserted text is what users see.
const messages = jest.requireActual("../../../services/notifications/messages");

const notify = jest.fn();

const notifyAfterLookup = async (context, prepare) => {
  try {
    const [userIDs, message] = await prepare();
    return await notify(userIDs, message);
  } catch {
    return [];
  }
};

module.exports = {
  notify,
  notifyAfterLookup,
  messages,
  shelterStaffIDs: jest.fn(),
  shelterManagerID: jest.fn(),
  activeAdminIDs: jest.fn(),
  acceptedAdopterForPet: jest.fn(),
  signupApproverIDs: jest.fn(),
};
