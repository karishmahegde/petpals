const { staffStatusDates } = require("../../../utils/staffDates");

describe("staffStatusDates", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const joined = new Date("2020-01-10");

  test("first approval stamps staffDOJ and clears staffDOS", () => {
    expect(staffStatusDates("Active", { staffDOJ: null }, now)).toEqual({
      staffDOJ: now,
      staffDOS: null,
    });
  });

  test("reactivation keeps the original staffDOJ, clears staffDOS", () => {
    expect(staffStatusDates("Active", { staffDOJ: joined }, now)).toEqual({
      staffDOS: null,
    });
  });

  test("deactivating someone who joined stamps staffDOS", () => {
    expect(staffStatusDates("Deactivated", { staffDOJ: joined }, now)).toEqual({
      staffDOS: now,
    });
  });

  test("closing your own account after joining stamps staffDOS, like deactivating", () => {
    expect(staffStatusDates("Closed", { staffDOJ: joined }, now)).toEqual({
      staffDOS: now,
    });
  });

  test("declining a Pending registration (never joined) sets no dates", () => {
    expect(staffStatusDates("Declined", { staffDOJ: null }, now)).toEqual({});
    expect(staffStatusDates("Deactivated", { staffDOJ: null }, now)).toEqual({});
  });

  test("going back to Pending (a reactivated worker) sets no dates", () => {
    expect(staffStatusDates("Pending", { staffDOJ: joined }, now)).toEqual({});
  });
});
