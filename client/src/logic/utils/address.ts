import { Country } from "country-state-city";

// The structured address every role carries (addressLine1/2, city, state,
// zip, country — same columns on every role table), plus a one-line
// display form for detail panels.
export interface Address {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// "12 Oak St, Apt 4, Athens, GA, 30601, United States" — skipping blank
// parts; "" when nothing is filled in yet.
export const formatAddress = (a: Address): string =>
  [
    a.addressLine1,
    a.addressLine2,
    [a.city, a.state].filter(Boolean).join(", "),
    a.zip,
    a.country,
  ]
    .filter(Boolean)
    .join(", ");

// country-state-city has no postal-code data at all - these are just format
// checks for the countries a user is most likely to be in. Any country not
// listed here only gets the plain non-empty check below.
const ZIP_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  IN: /^\d{6}$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  AU: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  JP: /^\d{3}-?\d{4}$/,
  CN: /^\d{6}$/,
  BR: /^\d{5}-?\d{3}$/,
  MX: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  SG: /^\d{6}$/,
  ZA: /^\d{4}$/,
};

// ISO code for a stored country name ("" if unknown) — the DB keeps plain
// names, not codes.
export const findCountryCode = (name: string) =>
  Country.getAllCountries().find((c) => c.name === name)?.isoCode ?? "";

// Every required part present (addressLine2 is the one optional column).
export const isAddressComplete = (a: Address) =>
  Boolean(
    a.addressLine1.trim() &&
      a.city.trim() &&
      a.state.trim() &&
      a.country.trim() &&
      a.zip.trim(),
  );

// ZIP format check for the address's own country (by name, as stored).
export const isValidZipForCountry = (zip: string, countryName: string) => {
  const trimmed = zip.trim();
  if (!trimmed) return false;
  const pattern = ZIP_PATTERNS[findCountryCode(countryName)];
  return pattern ? pattern.test(trimmed) : true;
};

// Trimmed copy ready to send — a blank addressLine2 clears to null.
export const toAddressPayload = (a: Address): Address => ({
  addressLine1: a.addressLine1.trim(),
  addressLine2: a.addressLine2?.trim() || null,
  city: a.city.trim(),
  state: a.state.trim(),
  zip: a.zip.trim(),
  country: a.country.trim(),
});
