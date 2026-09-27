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

  test("declining a Pending registration (never joined) sets no dates", () => {
    expect(staffStatusDates("Deactivated", { staffDOJ: null }, now)).toEqual({});
  });
});
