// Small phone-display helpers, same convention as logic/utils/datetime.ts.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Formats a stored E.164 string for read-only display, e.g. "+1 212 555 0105".
 * Falls back to the raw value if it doesn't parse (should not normally happen,
 * since the backend only ever stores validated E.164 strings). */
export const formatPhoneDisplay = (e164: string): string =>
  parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;

/** The ISO country code (e.g. "US") a stored E.164 string belongs to, for
 * rendering its flag — undefined if it doesn't parse. */
export const getPhoneCountry = (e164: string): CountryCode | undefined =>
  parsePhoneNumberFromString(e164)?.country;
