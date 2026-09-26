const { pickAddressUpdate } = require("../../../utils/address");

describe("pickAddressUpdate", () => {
  test("only returns the address fields that were sent, trimmed", () => {
    expect(
      pickAddressUpdate({ city: "  Athens ", zip: "30601", adminName: "x" }),
    ).toEqual({ city: "Athens", zip: "30601" });
  });

  test("addressLine2: null or blank clears it; other fields clear to \"\"", () => {
    expect(
      pickAddressUpdate({ addressLine2: "", city: "" }),
    ).toEqual({ addressLine2: null, city: "" });
    expect(pickAddressUpdate({ addressLine2: null })).toEqual({
      addressLine2: null,
    });
  });

  test("too long or not a string → BAD_REQUEST", () => {
    expect(() => pickAddressUpdate({ zip: "12345678901" })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
    expect(() => pickAddressUpdate({ city: 12 })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
    expect(() => pickAddressUpdate({ city: null })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });
});
