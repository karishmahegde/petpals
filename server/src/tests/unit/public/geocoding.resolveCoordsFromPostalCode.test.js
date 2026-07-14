// No mocking here — the `zipcodes` package is a static offline dataset
// lookup, not a live network call, so it's safe and deterministic to use
// directly rather than mocking it.
const { resolveCoordsFromPostalCode } = require("../../../services/geocoding");

describe("resolveCoordsFromPostalCode", () => {
  test("valid zip → returns { lat, lng }", () => {
    const result = resolveCoordsFromPostalCode("10001");

    expect(result).toEqual({ lat: 40.7484, lng: -73.9967 });
  });

  test("invalid/unrecognized zip → returns null", () => {
    expect(resolveCoordsFromPostalCode("00000")).toBeNull();
  });

  test("non-numeric garbage → returns null, doesn't throw", () => {
    expect(resolveCoordsFromPostalCode("abc")).toBeNull();
  });

  test("empty string → returns null", () => {
    expect(resolveCoordsFromPostalCode("")).toBeNull();
  });

  test("undefined input → returns null, doesn't throw", () => {
    expect(resolveCoordsFromPostalCode(undefined)).toBeNull();
  });

  // Edge case: lowest real US ZIP, with leading zeros — confirms leading
  // zeros aren't stripped/mishandled on the way to the lookup.
  test("edge-case zip with leading zeros (00501) resolves correctly", () => {
    const result = resolveCoordsFromPostalCode("00501");

    expect(result).toEqual({ lat: 40.8154, lng: -73.0451 });
  });

  test("numeric (not string) input still resolves correctly", () => {
    const result = resolveCoordsFromPostalCode(10001);

    expect(result).toEqual({ lat: 40.7484, lng: -73.9967 });
  });
});
