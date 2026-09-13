const { normalizePhone } = require("../../../utils/phone");

describe("normalizePhone", () => {
  test("valid US number in a common formatted style normalizes to E.164", () => {
    expect(normalizePhone("+1 (212) 555-0105")).toBe("+12125550105");
  });

  test("valid US number already in E.164 stays as-is", () => {
    expect(normalizePhone("+12125550105")).toBe("+12125550105");
  });

  test("valid non-US (UK) number normalizes to E.164", () => {
    expect(normalizePhone("+44 20 7183 8750")).toBe("+442071838750");
  });

  test("a bare national number with no country code is rejected — ambiguous without a country", () => {
    expect(() => normalizePhone("2125550105")).toThrow();
  });

  test("malformed input throws VALIDATION_ERROR, not a silent pass-through", () => {
    try {
      normalizePhone("not a phone number");
      throw new Error("expected normalizePhone to throw");
    } catch (err) {
      expect(err.code).toBe("VALIDATION_ERROR");
    }
  });

  test("a number that is too long to be valid is rejected", () => {
    expect(() => normalizePhone("+1999999999999999")).toThrow();
  });

  test("non-string input is rejected", () => {
    expect(() => normalizePhone(12125550105)).toThrow();
    expect(() => normalizePhone(null)).toThrow();
  });
});
