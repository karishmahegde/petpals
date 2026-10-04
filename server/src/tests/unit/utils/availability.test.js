const {
  DAYS,
  SLOTS,
  parseAvailabilityInput,
  encodeAvailability,
  decodeAvailability,
} = require("../../../utils/availability");

describe("utils/availability", () => {
  describe("parseAvailabilityInput", () => {
    test("canonicalises: days Mon→Sun, slots Morning→Afternoon→Evening, duplicates and empty days dropped", () => {
      expect(
        parseAvailabilityInput({
          Wed: ["Evening"],
          Mon: ["Evening", "Morning", "Morning"],
          Sun: [],
        }),
      ).toEqual({ Mon: ["Morning", "Evening"], Wed: ["Evening"] });
    });

    test("{} is valid — no availability at all", () => {
      expect(parseAvailabilityInput({})).toEqual({});
    });

    test.each([
      ["missing", undefined],
      ["null", null],
      ["a string", "Mon:MA"],
      ["an array", [["Mon", "Morning"]]],
    ])("%s → 400", (_label, value) => {
      expect(() => parseAvailabilityInput(value)).toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    test("unknown day → 400 naming it", () => {
      expect(() => parseAvailabilityInput({ Monday: ["Morning"] })).toThrow(
        "Unknown day(s): Monday — use Mon, Tue, Wed, Thu, Fri, Sat, Sun",
      );
    });

    test("unknown slot → 400 naming it", () => {
      expect(() => parseAvailabilityInput({ Tue: ["Morning", "Night"] })).toThrow(
        "Unknown slot(s) for Tue: Night — use Morning, Afternoon, Evening",
      );
    });

    test("a day that isn't a list → 400", () => {
      expect(() => parseAvailabilityInput({ Fri: "Morning" })).toThrow(
        "availability.Fri must be a list of slots",
      );
    });
  });

  describe("encode / decode", () => {
    test("round-trips through the compact stored form", () => {
      const availability = { Mon: ["Morning", "Afternoon"], Wed: ["Evening"] };

      expect(encodeAvailability(availability)).toBe("Mon:MA;Wed:E");
      expect(decodeAvailability("Mon:MA;Wed:E")).toEqual(availability);
    });

    test("no availability encodes to null and null decodes to {}", () => {
      expect(encodeAvailability({})).toBeNull();
      expect(decodeAvailability(null)).toEqual({});
      expect(decodeAvailability("")).toEqual({});
    });

    test("every slot of every day fits VARCHAR(100)", () => {
      const all = Object.fromEntries(DAYS.map((day) => [day, SLOTS]));

      expect(encodeAvailability(all).length).toBeLessThanOrEqual(100);
      expect(decodeAvailability(encodeAvailability(all))).toEqual(all);
    });

    test.each([
      "Weekends 9am-5pm",
      "Saturdays",
      "Mon:MX",
      "Mon:MM",
      "Mon:M;Mon:E",
      "Mon:M;",
    ])("%p isn't the stored format → null (free text kept as-is by callers)", (stored) => {
      expect(decodeAvailability(stored)).toBeNull();
    });
  });
});
