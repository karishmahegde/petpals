// The structured address every role table carries (same columns as
// Adopter's) — shared so every select/validation lists the same fields.
// Column lengths mirror schema.prisma.
const ADDRESS_MAX_LENGTH = {
  addressLine1: 100,
  addressLine2: 100,
  city: 45,
  state: 45,
  zip: 10,
  country: 45,
};

const ADDRESS_FIELDS = Object.keys(ADDRESS_MAX_LENGTH);

// Prisma select fragment for all six columns.
const ADDRESS_SELECT = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, true]));

// Validates whichever address fields a self-service profile update sent
// (partial update — absent fields are skipped) and returns them ready to
// save. addressLine2 is nullable (null or "" clears it); the rest are NOT
// NULL with a "" default, so clearing one stores "". Throws a BAD_REQUEST
// error on a bad value.
const pickAddressUpdate = (body) => {
  const data = {};
  for (const field of ADDRESS_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (field === "addressLine2" && (value === null || value === "")) {
      data[field] = null;
      continue;
    }
    if (typeof value !== "string" || value.trim().length > ADDRESS_MAX_LENGTH[field]) {
      const err = new Error(
        `${field} must be a string of at most ${ADDRESS_MAX_LENGTH[field]} characters`,
      );
      err.code = "BAD_REQUEST";
      throw err;
    }
    const trimmed = value.trim();
    data[field] = field === "addressLine2" && !trimmed ? null : trimmed;
  }
  return data;
};

module.exports = {
  ADDRESS_FIELDS,
  ADDRESS_MAX_LENGTH,
  ADDRESS_SELECT,
  pickAddressUpdate,
};
