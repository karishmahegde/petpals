// Why we need it: every phone-carrying table (Adopter, Staff, Veterinarian,
// Volunteer, Donor, Shelter) stores phone numbers as E.164 strings
// (e.g. "+12125550105") — this is the one place that parses/validates an
// incoming phone string so no service re-implements the same regex.
const { parsePhoneNumberFromString } = require("libphonenumber-js");

const invalidPhone = () => {
  const err = new Error("phone must be a valid phone number");
  err.code = "VALIDATION_ERROR";
  return err;
};

// Parses `raw` and returns its normalized E.164 form. Throws VALIDATION_ERROR
// if it doesn't parse to a valid number — never stores what the client sent
// as-is, even if it looks correct.
const normalizePhone = (raw) => {
  if (typeof raw !== "string") {
    throw invalidPhone();
  }
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed || !parsed.isValid()) {
    throw invalidPhone();
  }
  return parsed.number;
};

module.exports = { normalizePhone };
